const cloudinary = require('../config/cloudinary');
const pool = require('../config/db');

/**
 * This script updates all existing Cloudinary files in lms-cpd folder to be publicly accessible
 * and updates the database with the correct URLs
 */

async function fixCloudinaryAccess() {
  try {
    console.log('🔧 Starting Cloudinary access fix...\n');

    // Get all resources in lms-cpd folder
    console.log('📂 Fetching resources from lms-cpd folder...');
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'lms-cpd/',
      max_results: 500,
      resource_type: 'image' // This includes PDFs that were uploaded as images
    });

    console.log(`Found ${result.resources.length} resources\n`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const resource of result.resources) {
      try {
        console.log(`Processing: ${resource.public_id}`);
        
        // Update to public access
        const updated = await cloudinary.uploader.explicit(resource.public_id, {
          type: 'upload',
          access_control: [
            {
              access_type: 'anonymous',
              start: null,
              end: null
            }
          ],
          access_mode: 'public'
        });

        console.log(`✅ Made public: ${resource.public_id}`);
        updatedCount++;

        // If it's a PDF, we should re-upload it as 'raw' resource type
        if (resource.format === 'pdf') {
          try {
            // Delete the old one from 'image' type
            await cloudinary.uploader.destroy(resource.public_id, {
              resource_type: 'image',
              invalidate: true
            });

            // Get the file URL and re-upload as raw
            const newUpload = await cloudinary.uploader.upload(resource.secure_url, {
              folder: 'lms-cpd',
              resource_type: 'raw',
              public_id: resource.public_id.replace('lms-cpd/', ''),
              access_mode: 'public',
              type: 'upload'
            });

            console.log(`✅ Re-uploaded as raw: ${newUpload.secure_url}`);

            // Update database URLs
            const [files] = await pool.query(
              `UPDATE cpd_topic_files SET file_path = ? WHERE file_path LIKE ?`,
              [newUpload.secure_url, `%${resource.public_id}%`]
            );
            
            if (files.affectedRows > 0) {
              console.log(`✅ Updated ${files.affectedRows} database records`);
            }
          } catch (reuploadError) {
            console.error(`❌ Failed to re-upload ${resource.public_id}:`, reuploadError.message);
          }
        }

      } catch (error) {
        console.error(`❌ Error processing ${resource.public_id}:`, error.message);
        errorCount++;
      }
    }

    // Also check for 'raw' resources
    console.log('\n📂 Fetching raw resources from lms-cpd folder...');
    const rawResult = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'lms-cpd/',
      max_results: 500,
      resource_type: 'raw'
    });

    console.log(`Found ${rawResult.resources.length} raw resources\n`);

    for (const resource of rawResult.resources) {
      try {
        console.log(`Processing raw: ${resource.public_id}`);
        
        // Update to public access
        await cloudinary.uploader.explicit(resource.public_id, {
          type: 'upload',
          resource_type: 'raw',
          access_mode: 'public'
        });

        console.log(`✅ Made public: ${resource.public_id}`);
        updatedCount++;

      } catch (error) {
        console.error(`❌ Error processing ${resource.public_id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ Successfully updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('='.repeat(50));
    console.log('\n✨ Done! All files should now be publicly accessible.\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
fixCloudinaryAccess();

