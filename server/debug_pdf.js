import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { PDFParse } from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

dotenv.config({ path: path.resolve(projectRoot, '.env') });

const DEFAULT_GDOC_PATH = '/Users/pete/Library/CloudStorage/GoogleDrive-wellclouder@gmail.com/My Drive/jobs/cv_resume/mine/byPlaces/latest_submit/bio/CV_PanjunKim_BASE.gdoc';

function extractGoogleFileId(input) {
    if (!input) return '';
    const value = String(input).trim();
    const directIdMatch = value.match(/^[a-zA-Z0-9_-]{20,}$/);
    if (directIdMatch) return directIdMatch[0];
    const fileMatch = value.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return fileMatch[1];
    const docMatch = value.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docMatch?.[1]) return docMatch[1];
    const idParam = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParam?.[1]) return idParam[1];
    return '';
}

function readGoogleDocIdFromGdocPath(gdocPath) {
    if (!gdocPath || !fs.existsSync(gdocPath)) {
        return '';
    }
    const parsed = JSON.parse(fs.readFileSync(gdocPath, 'utf-8'));
    return extractGoogleFileId(parsed.doc_id || '');
}

function buildGoogleDriveAuth() {
    const scopes = ['https://www.googleapis.com/auth/drive'];
    const localKeyPath = path.resolve(projectRoot, 'service-account-key.json');
    if (fs.existsSync(localKeyPath)) {
        return new google.auth.GoogleAuth({
            keyFile: localKeyPath,
            scopes
        });
    }
    return new google.auth.GoogleAuth({ scopes });
}

async function main() {
    const docId = readGoogleDocIdFromGdocPath(DEFAULT_GDOC_PATH);
    console.log('Doc ID:', docId);
    
    const auth = buildGoogleDriveAuth();
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    console.log('Exporting Google Doc to PDF...');
    const response = await drive.files.export(
        {
            fileId: docId,
            mimeType: 'application/pdf'
        },
        {
            responseType: 'arraybuffer'
        }
    );
    const pdfBuffer = Buffer.from(response.data);
    
    const parser = new PDFParse({ data: pdfBuffer });
    const pageCount = 8; // We know it has 8 pages
    
    console.log('--- Page Texts ---');
    for (let page = 1; page <= pageCount; page++) {
        try {
            const parsed = await parser.getText({ partial: [page] });
            const rawText = String(parsed.text || '');
            const normalized = rawText
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase()
                .replace(/--\s*\d+\s+of\s+\d+\s*--/g, '')
                .trim();
                
            console.log(`\n[PAGE ${page}]`);
            console.log('Raw text length:', rawText.length);
            console.log('Normalized text:', JSON.stringify(normalized));
            console.log('Matches /^tab\\s+(\\d+)$/:', /^tab\\s+(\d+)$/.test(normalized));
        } catch (e) {
            console.error(`Page ${page} failed:`, e.message);
        }
    }
    await parser.destroy();
}

main().catch(console.error);
