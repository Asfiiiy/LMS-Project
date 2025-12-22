# Setup Instructions for Course Management with Cloudinary

## 1. Database Setup

Run the following SQL commands in your MySQL database:

```sql
-- Add start_date and end_date to courses table
ALTER TABLE courses 
ADD COLUMN start_date DATE NULL,
ADD COLUMN end_date DATE NULL;

-- Create sub_categories table
CREATE TABLE IF NOT EXISTS sub_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES course_categories(id) ON DELETE CASCADE,
    UNIQUE KEY unique_subcategory (category_id, name)
);

-- Add sub_category_id to courses table
ALTER TABLE courses 
ADD COLUMN sub_category_id INT NULL,
ADD FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id) ON DELETE SET NULL;

-- Add unit_id to resources, assignments, and quizzes if not exists
ALTER TABLE resources ADD COLUMN IF NOT EXISTS unit_id INT NULL;
ALTER TABLE resources ADD FOREIGN KEY IF NOT EXISTS (unit_id) REFERENCES units(id) ON DELETE SET NULL;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS unit_id INT NULL;
ALTER TABLE assignments ADD FOREIGN KEY IF NOT EXISTS (unit_id) REFERENCES units(id) ON DELETE SET NULL;

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS unit_id INT NULL;
ALTER TABLE quizzes ADD FOREIGN KEY IF NOT EXISTS (unit_id) REFERENCES units(id) ON DELETE SET NULL;
```

## 2. Install Dependencies

```bash
cd lms-app/backend
npm install cloudinary
```

## 3. Cloudinary Configuration

The Cloudinary configuration is already set up in `backend/config/cloudinary.js` with your credentials:
- Cloud Name: dlbgdbmnt
- API Key: 937666398522797
- API Secret: 9GIjV08yTrj3nnXU3GYR0xFHL_w

## 4. Features Added

### Backend:
- ✅ Course creation/update with start_date, end_date, and sub_category_id
- ✅ Sub-category management (create, get by category)
- ✅ Cloudinary integration for all file uploads (PDFs, videos, documents)
- ✅ File uploads now store Cloudinary URLs instead of local paths
- ✅ Unit-based file organization

### Frontend:
- ✅ Course form with start/end dates
- ✅ Sub-category selection (dependent on category)
- ✅ All files uploaded to Cloudinary
- ✅ Files display with Cloudinary URLs

## 5. How It Works

1. **File Uploads**: All files (PDFs, videos, etc.) are uploaded to Cloudinary and only the URL is stored in the database
2. **Sub-Categories**: When you select a category, sub-categories for that category are loaded
3. **Course Dates**: Start and end dates help track course duration
4. **File Storage**: Files are organized in Cloudinary folders: `lms/courses/{courseId}/units/{unitId}`

## 6. Testing

1. Create a course with start/end dates and sub-category
2. Upload a PDF file - it will be stored in Cloudinary
3. View the course - files will load from Cloudinary URLs
4. Check your Cloudinary dashboard to see uploaded files

