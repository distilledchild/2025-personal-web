/**
 * insert_museum.js
 * Inserts cities and museums into MongoDB.
 * Usage: edit newCities / newMuseums arrays below, then run:
 *   /Users/pete/.aside/runtime/bin/node insert_museum.js
 */

import mongoose from 'mongoose';

const uri = 'mongodb+srv://distilledchild_db_user:D!st!ll2dch!ld@distilledchildwebpage.0eoyzf5.mongodb.net/webpage?retryWrites=true&w=majority';

async function insertData() {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // ─── Edit cities to insert ────────────────────────────────────────────────
    const newCities = [
        // Example — add/edit entries as needed:
        // { city_code: 'ABQ', city_name: 'Albuquerque', state_code: 'NM', latitude: 35.0853, longitude: -106.6056, status: 'VISITED' },
    ];

    // ─── Edit museums to insert ───────────────────────────────────────────────
    const newMuseums = [
        // Example — add/edit entries as needed:
        // { museum_code: 'ABM', museum_name: 'Albuquerque Museum', city_code: 'ABQ', state: 'NM', show: 'Y', artworks: [] },
    ];

    // ─── Insert Cities ────────────────────────────────────────────────────────
    if (newCities.length > 0) {
        console.log('\n📍 Inserting cities...');
        for (const city of newCities) {
            const existing = await db.collection('CITY').findOne({ city_code: city.city_code });
            if (existing) {
                console.log(`  ⚠️  City ${city.city_code} (${city.city_name}) already exists, skipping.`);
            } else {
                const result = await db.collection('CITY').insertOne(city);
                console.log(`  ✅ Inserted city: ${city.city_name} (${city.city_code}) → _id: ${result.insertedId}`);
            }
        }
    }

    // ─── Insert Museums ───────────────────────────────────────────────────────
    if (newMuseums.length > 0) {
        console.log('\n🎨 Inserting museums...');
        for (const museum of newMuseums) {
            const existing = await db.collection('INTERESTS_ART_MUSEUM').findOne({ museum_code: museum.museum_code });
            if (existing) {
                console.log(`  ⚠️  Museum ${museum.museum_code} (${museum.museum_name}) already exists, skipping.`);
            } else {
                const result = await db.collection('INTERESTS_ART_MUSEUM').insertOne(museum);
                console.log(`  ✅ Inserted museum: ${museum.museum_name} (${museum.museum_code}) → _id: ${result.insertedId}`);
            }
        }
    }

    // ─── Verify ───────────────────────────────────────────────────────────────
    console.log('\n🔍 Verification...');
    const cityCodes = newCities.map(c => c.city_code);
    const museumCodes = newMuseums.map(m => m.museum_code);

    if (cityCodes.length > 0) {
        const insertedCities = await db.collection('CITY').find({ city_code: { $in: cityCodes } }).toArray();
        console.log(`  ✅ Cities in DB:  ${insertedCities.map(c => c.city_code).join(', ')}`);
    }
    if (museumCodes.length > 0) {
        const insertedMuseums = await db.collection('INTERESTS_ART_MUSEUM').find({ museum_code: { $in: museumCodes } }).toArray();
        console.log(`  ✅ Museums in DB: ${insertedMuseums.map(m => m.museum_code).join(', ')}`);
    }

    console.log('\n🎉 Done!');
    console.log('\n📋 Next steps:');
    console.log('  1. Upload photos to GCS bucket "distilledchild":');
    console.log('     interests/art/{MUSEUM_CODE}/');
    console.log('  2. Run: node server/sync-artworks.js');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
}

insertData().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
