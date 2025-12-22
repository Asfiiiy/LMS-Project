# File Storage Information

## Overview
All files (PDFs, documents, images, videos) are stored in **Cloudinary only**. The database stores only the Cloudinary URL links, not the actual files.

## Storage Architecture

### ✅ Cloudinary (Primary Storage)
- **Location**: All files uploaded to Cloudinary
- **Database**: Only Cloudinary URLs stored in `file_path` columns
- **Access**: Files are publicly accessible via Cloudinary URLs
- **File Size Limit**: 
  - Free tier: 10MB for raw files (PDFs, documents)
  - Images/Videos: Higher limits
  - Error shown if file exceeds limit

### ❌ Local Storage (Removed)
- **No local file storage** for course files
- Files are uploaded to memory, then directly to Cloudinary
- No files saved to `uploads/` directory (except temporary backup processing)
- Database does NOT store file binary data

## File Upload Flow

1. **User uploads file** → Frontend sends to backend
2. **Backend receives** → File stored in memory (multer memoryStorage)
3. **Upload to Cloudinary** → File uploaded directly to Cloudinary
4. **Save URL to database** → Only Cloudinary URL saved in `file_path` column
5. **Memory cleared** → File buffer removed from memory

## Database Schema

All file-related tables store **URLs only**:
- `resources.file_path` → Cloudinary URL
- `course_files.file_path` → Cloudinary URL  
- `assignment_submissions.file_path` → Cloudinary URL

## File Size Handling

- **Multer limit**: 100MB (for receiving files)
- **Cloudinary limit**: 10MB for raw files (PDFs, documents)
- **Error handling**: Clear error message if file exceeds Cloudinary limit
- **Recommendation**: Compress large PDFs before uploading

## Course Deletion

When deleting a course:
- All related records are deleted (resources, assignments, quizzes, units, etc.)
- **Note**: Files in Cloudinary are NOT automatically deleted
- Only database records (URLs) are removed
- To free Cloudinary storage, manually delete files from Cloudinary dashboard

## Backup Files

- Backup files (`.mbz`, `.json`) are temporarily written to disk for processing
- Temp files are automatically cleaned up after processing
- No permanent local storage of backup files

## Migration Notes

If you have old files stored locally:
1. They can still be accessed via `/uploads/` route (legacy support)
2. New uploads go to Cloudinary only
3. Consider migrating old files to Cloudinary if needed

