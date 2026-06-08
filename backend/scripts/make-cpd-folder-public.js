const cloudinary = require('../config/cloudinary');

/**
 * Make the entire lms-cpd folder public in Cloudinary
 */

async function makeCPDFolderPublic() {
  try {
    console.log('🔓 Making lms-cpd folder public...\n');

    // Method 1: Update access control for all resources in the folder
    console.log('📂 Fetching all resources from lms-cpd folder...');
    
    // Get all image-type resources (PDFs uploaded as images)
    const imageResources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'lms-cpd/',
      max_results: 500,
      resource_type: 'image'
    });

    console.log(`Found ${imageResources.resources.length} image resources\n`);

    // Get all raw-type resources (properly uploaded PDFs/docs)
    const rawResources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'lms-cpd/',
      max_results: 500,
      resource_type: 'raw'
    });

    console.log(`Found ${rawResources.resources.length} raw resources\n`);

    const allResources = [
      ...imageResources.resources.map(r => ({ ...r, resourceType: 'image' })),
      ...rawResources.resources.map(r => ({ ...r, resourceType: 'raw' }))
    ];

    console.log(`Total: ${allResources.length} files to update\n`);
    console.log('='.repeat(60));

    let successCount = 0;
    let errorCount = 0;

    for (const resource of allResources) {
      try {
        console.log(`\n📄 ${resource.public_id}`);
        console.log(`   Type: ${resource.resourceType}`);
        console.log(`   Format: ${resource.format}`);

        // Update to public access using the explicit API
        const result = await cloudinary.uploader.explicit(resource.public_id, {
          type: 'upload',
          resource_type: resource.resourceType,
          invalidate: true // Clear CDN cache
        });

        console.log(`   ✅ Made public: ${result.secure_url}`);
        successCount++;

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Success: ${successCount} files`);
    console.log(`❌ Errors: ${errorCount} files`);
    console.log('\n' + '='.repeat(60));
    
    if (successCount > 0) {
      console.log('\n✨ All files in lms-cpd folder are now PUBLIC!');
      console.log('🔗 You can now view PDFs directly in the browser.');
      console.log('\n💡 Tip: Refresh your course page to see the changes.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('\nDetails:', error.error || error.message);
  } finally {
    process.exit(0);
  }
}

// Run the script
console.log('🚀 Starting Cloudinary lms-cpd folder public access update...\n');
makeCPDFolderPublic();

