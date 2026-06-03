import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { google } from 'googleapis';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(projectRoot, '.env') });

const DEFAULT_GDOC_PATH = '/Users/pete/Library/CloudStorage/GoogleDrive-wellclouder@gmail.com/My Drive/jobs/cv_resume/mine/byPlaces/latest_submit/bio/CV_PanjunKim_BASE.gdoc';
const DEFAULT_STATE_PATH = path.resolve(projectRoot, '.cache/cv-sync-state.json');
const DEFAULT_INTERVAL_SECONDS = 600;

const ABOUT_ACADEMIC_COLLECTION = 'ABOUT_ACADEMIC';

const aboutAcademicSchema = new mongoose.Schema({
    links: {
        cv: String
    },
    show: { type: String, default: 'Y' },
    updated_at: { type: Date, default: Date.now }
}, { collection: ABOUT_ACADEMIC_COLLECTION });

const AboutAcademic = mongoose.models.AboutAcademicCvSync || mongoose.model('AboutAcademicCvSync', aboutAcademicSchema);

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    const getOption = (name) => {
        const prefix = `${name}=`;
        const match = argv.find((item) => item.startsWith(prefix));
        return match ? match.slice(prefix.length) : undefined;
    };
    return {
        watch: args.has('--watch'),
        once: args.has('--once') || !args.has('--watch'),
        dryRun: args.has('--dry-run'),
        force: args.has('--force'),
        printConfig: args.has('--print-config'),
        sourceDocId: getOption('--source-doc-id') || process.env.CV_SOURCE_DOC_ID || '',
        gdocPath: getOption('--gdoc-path') || process.env.CV_SOURCE_GDOC_PATH || DEFAULT_GDOC_PATH,
        statePath: getOption('--state-path') || process.env.CV_SYNC_STATE_PATH || DEFAULT_STATE_PATH,
        intervalSeconds: Number(getOption('--interval-seconds') || process.env.CV_SYNC_INTERVAL_SECONDS || DEFAULT_INTERVAL_SECONDS),
        targetFileId: getOption('--target-file-id') || process.env.CV_TARGET_DRIVE_FILE_ID || ''
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureParentDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return fallback;
    }
}

function writeJson(filePath, value) {
    ensureParentDir(filePath);
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function extractGoogleFileId(input) {
    if (!input) return '';
    const directIdMatch = String(input).match(/^[a-zA-Z0-9_-]{20,}$/);
    if (directIdMatch) return directIdMatch[0];
    const fileMatch = String(input).match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return fileMatch[1];
    const docMatch = String(input).match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch?.[1]) return docMatch[1];
    const idParam = String(input).match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam?.[1]) return idParam[1];
    return '';
}

function readDocIdFromGdocFile(gdocPath) {
    const raw = fs.readFileSync(gdocPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const docId = extractGoogleFileId(parsed.doc_id || '');
    if (!docId) {
        throw new Error(`Unable to read doc_id from ${gdocPath}`);
    }
    return {
        docId,
        email: parsed.email || '',
        resourceKey: parsed.resource_key || ''
    };
}

function buildGoogleAuth() {
    const scopes = ['https://www.googleapis.com/auth/drive'];

    if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
        return new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY),
            scopes
        });
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        return new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            scopes
        });
    }

    const localKeyPath = path.resolve(projectRoot, 'service-account-key.json');
    if (fs.existsSync(localKeyPath)) {
        return new google.auth.GoogleAuth({
            keyFile: localKeyPath,
            scopes
        });
    }

    return new google.auth.GoogleAuth({ scopes });
}

async function resolveTargetFileId(config) {
    if (config.targetFileId) {
        return config.targetFileId;
    }

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error('CV_TARGET_DRIVE_FILE_ID is not set and MONGODB_URI is unavailable.');
    }

    const connection = await mongoose.connect(mongoUri);
    try {
        const aboutAcademic = await AboutAcademic.findOne({ show: 'Y' }).lean();
        const cvUrl = aboutAcademic?.links?.cv || '';
        const fileId = extractGoogleFileId(cvUrl);
        if (!fileId) {
            throw new Error('Unable to resolve CV target file id from ABOUT_ACADEMIC.links.cv');
        }
        return fileId;
    } finally {
        await connection.disconnect();
    }
}

async function getDriveClient() {
    const auth = buildGoogleAuth();
    const authClient = await auth.getClient();
    return google.drive({ version: 'v3', auth: authClient });
}

async function fetchFileMetadata(drive, fileId) {
    const response = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,modifiedTime,webViewLink,webContentLink,parents'
    });
    return response.data;
}

async function exportGoogleDocToPdf(drive, fileId) {
    const response = await drive.files.export(
        {
            fileId,
            mimeType: 'application/pdf'
        },
        {
            responseType: 'arraybuffer'
        }
    );

    return Buffer.from(response.data);
}

async function maybeStripLeadingTabCoverPage(pdfBuffer) {
    const originalPdf = await PDFDocument.load(pdfBuffer);
    const pageCount = originalPdf.getPageCount();

    if (pageCount <= 1) {
        return {
            buffer: pdfBuffer,
            stripped: false,
            firstPageText: '',
            pageCount
        };
    }

    const parser = new PDFParse({ data: Buffer.from(pdfBuffer) });

    const readPageText = async (pageNumber) => {
        const parsed = await parser.getText({ partial: [pageNumber] });
        return String(parsed.text || '').trim();
    };

    const normalizePageText = (value) => value
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/--\s*\d+\s+of\s+\d+\s*--/g, '')
        .trim();

    let firstPageText = '';
    try {
        firstPageText = await readPageText(1);
    } catch (error) {
        await parser.destroy();
        return {
            buffer: pdfBuffer,
            stripped: false,
            firstPageText: '',
            pageCount
        };
    }

    const normalizedFirstPage = normalizePageText(firstPageText);
    const firstPageTabMatch = normalizedFirstPage.match(/^tab\s+(\d+)$/);
    const looksLikeDriveTabCover =
        Boolean(firstPageTabMatch) &&
        normalizedFirstPage.length <= 16;

    if (!looksLikeDriveTabCover) {
        await parser.destroy();
        return {
            buffer: pdfBuffer,
            stripped: false,
            firstPageText,
            pageCount
        };
    }

    const currentTabNumber = Number(firstPageTabMatch[1]);
    let keepStartIndex = 2;
    let keepEndExclusive = pageCount;

    for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
        const pageText = await readPageText(pageNumber);
        const normalizedPage = normalizePageText(pageText);
        const tabMatch = normalizedPage.match(/^tab\s+(\d+)$/);

        if (!tabMatch) {
            continue;
        }

        const tabNumber = Number(tabMatch[1]);
        if (tabNumber === currentTabNumber) {
            keepStartIndex = pageNumber;
            continue;
        }

        keepEndExclusive = pageNumber - 1;
        break;
    }

    await parser.destroy();

    const pageIndexesToKeep = [];
    for (let pageIndex = keepStartIndex - 1; pageIndex < keepEndExclusive; pageIndex += 1) {
        pageIndexesToKeep.push(pageIndex);
    }

    if (pageIndexesToKeep.length === 0) {
        return {
            buffer: pdfBuffer,
            stripped: false,
            firstPageText,
            pageCount
        };
    }

    const trimmedPdf = await PDFDocument.create();
    const copiedPages = await trimmedPdf.copyPages(originalPdf, pageIndexesToKeep);
    copiedPages.forEach((page) => trimmedPdf.addPage(page));

    return {
        buffer: Buffer.from(await trimmedPdf.save()),
        stripped: true,
        firstPageText,
        pageCount
    };
}

async function updateTargetPdfFile(drive, targetFileId, pdfBuffer) {
    const response = await drive.files.update({
        fileId: targetFileId,
        media: {
            mimeType: 'application/pdf',
            body: Readable.from(pdfBuffer)
        },
        fields: 'id,name,mimeType,modifiedTime,webViewLink,webContentLink'
    });

    return response.data;
}

async function syncAcademicCv(config) {
    let docId = extractGoogleFileId(config.sourceDocId);
    let gdocInfo = { docId, email: '', resourceKey: '' };

    if (!docId) {
        if (config.gdocPath && fs.existsSync(config.gdocPath)) {
            gdocInfo = readDocIdFromGdocFile(config.gdocPath);
        } else {
            throw new Error('Google Doc ID is not specified. Please set CV_SOURCE_DOC_ID in env or provide a valid .gdoc file path.');
        }
    }

    const drive = await getDriveClient();
    const targetFileId = await resolveTargetFileId(config);
    const state = loadJson(config.statePath, {});

    const sourceMeta = await fetchFileMetadata(drive, gdocInfo.docId);
    if (sourceMeta.mimeType !== 'application/vnd.google-apps.document') {
        throw new Error(`Source file ${gdocInfo.docId} is not a Google Doc. mimeType=${sourceMeta.mimeType}`);
    }

    const targetMeta = await fetchFileMetadata(drive, targetFileId);
    const sourceModifiedTime = sourceMeta.modifiedTime || '';
    const previousModifiedTime = state.lastSourceModifiedTime || '';

    const result = {
        sourceDocId: gdocInfo.docId,
        targetFileId,
        sourceName: sourceMeta.name || '',
        targetName: targetMeta.name || '',
        sourceModifiedTime,
        previousModifiedTime,
        skipped: false,
        updated: false,
        dryRun: config.dryRun
    };

    if (!config.force && previousModifiedTime && previousModifiedTime === sourceModifiedTime) {
        result.skipped = true;
        return result;
    }

    if (config.dryRun) {
        result.updated = true;
        return result;
    }

    const pdfBuffer = await exportGoogleDocToPdf(drive, gdocInfo.docId);
    const cleanedPdf = await maybeStripLeadingTabCoverPage(pdfBuffer);
    const updatedTarget = await updateTargetPdfFile(drive, targetFileId, cleanedPdf.buffer);

    writeJson(config.statePath, {
        sourceDocId: gdocInfo.docId,
        targetFileId,
        sourceName: sourceMeta.name || '',
        targetName: updatedTarget.name || targetMeta.name || '',
        lastSourceModifiedTime: sourceModifiedTime,
        lastTargetModifiedTime: updatedTarget.modifiedTime || '',
        lastSyncedAt: new Date().toISOString(),
        gdocPath: config.gdocPath
    });

    result.updated = true;
    result.targetModifiedTime = updatedTarget.modifiedTime || '';
    result.targetWebViewLink = updatedTarget.webViewLink || targetMeta.webViewLink || '';
    result.strippedLeadingTabCoverPage = cleanedPdf.stripped;
    result.firstPageText = cleanedPdf.firstPageText;
    return result;
}

async function runOnce(config) {
    const result = await syncAcademicCv(config);
    console.log(JSON.stringify(result, null, 2));
    return result;
}

async function runWatch(config) {
    let docId = extractGoogleFileId(config.sourceDocId);
    if (!docId && config.gdocPath && fs.existsSync(config.gdocPath)) {
        try {
            docId = readDocIdFromGdocFile(config.gdocPath).docId;
        } catch {}
    }
    console.log(`Watching Google Doc changes via Drive modifiedTime polling every ${config.intervalSeconds} seconds.`);
    console.log(`Source Google Doc ID: ${docId || 'unknown'}`);
    for (;;) {
        try {
            await runOnce(config);
        } catch (error) {
            console.error('[cv-sync] run failed:', error instanceof Error ? error.message : error);
        }
        await sleep(config.intervalSeconds * 1000);
    }
}

async function main() {
    const config = parseArgs(process.argv);

    if (config.printConfig) {
        let docId = extractGoogleFileId(config.sourceDocId);
        if (!docId && config.gdocPath && fs.existsSync(config.gdocPath)) {
            try {
                docId = readDocIdFromGdocFile(config.gdocPath).docId;
            } catch {}
        }
        const targetFileId = await resolveTargetFileId(config).catch(() => '');
        console.log(JSON.stringify({
            sourceDocId: docId || '',
            gdocPath: config.gdocPath,
            statePath: config.statePath,
            intervalSeconds: config.intervalSeconds,
            targetFileId
        }, null, 2));
        return;
    }

    if (config.watch) {
        await runWatch(config);
        return;
    }

    await runOnce(config);
}

main().catch((error) => {
    console.error('[cv-sync] fatal:', error instanceof Error ? error.stack || error.message : error);
    process.exitCode = 1;
});
