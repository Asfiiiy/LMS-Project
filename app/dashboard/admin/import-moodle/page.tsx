'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/app/services/api';
import { useRouter } from 'next/navigation';

interface Category {
  id: number;
  name: string;
}

interface SubCategory {
  id: number;
  category_id: number;
  name: string;
}

export default function ImportMoodlePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>('');
  const [subCategoryId, setSubCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [filteredSubCategories, setFilteredSubCategories] = useState<SubCategory[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [uploadComplete, setUploadComplete] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (categoryId) {
      const filtered = subCategories.filter(
        (sub) => sub.category_id === parseInt(categoryId)
      );
      setFilteredSubCategories(filtered);
      setSubCategoryId(''); // Reset subcategory when category changes
    } else {
      setFilteredSubCategories([]);
      setSubCategoryId('');
    }
  }, [categoryId, subCategories]);

  const loadCategories = async () => {
    try {
      const [catsRes, subCatsRes] = await Promise.all([
        apiService.getCategories(),
        apiService.getSubCategories(),
      ]);
      
      // Handle API response format
      const cats = catsRes?.categories || catsRes || [];
      const subCats = subCatsRes?.subCategories || subCatsRes || [];
      
      setCategories(cats);
      setSubCategories(subCats);
    } catch (err) {
      console.error('Error loading categories:', err);
      setError('Failed to load categories');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase();
      if (ext.endsWith('.mbz')) {
        setFile(selectedFile);
        setError('');
        setUploadComplete(false);
      } else {
        setError('Please select a valid Moodle backup file (.mbz)');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setUploading(true);
    setError('');
    setStatus('Uploading file...');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('backupFile', file);
      formData.append('categoryId', categoryId);
      if (subCategoryId) {
        formData.append('subCategoryId', subCategoryId);
      }

      setStatus('Extracting backup...');
      setProgress(30);

      const response = await fetch('http://localhost:5000/api/admin/courses/restore', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      setStatus('Extracting files...');
      setProgress(50);

      // Simulate progress for file extraction
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStatus('Uploading to Cloudinary...');
      setProgress(70);

      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStatus('Creating course structure...');
      setProgress(90);

      await new Promise((resolve) => setTimeout(resolve, 500));
      setProgress(100);
      setStatus('Import completed successfully! ✅');
      setUploadComplete(true);

      // Show success message
      setTimeout(() => {
        router.push('/dashboard/admin?tab=courses');
      }, 2000);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to import Moodle backup');
      setStatus('');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="mb-4 text-blue-600 hover:text-blue-700 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Import Moodle Course</h1>
          <p className="text-gray-600 mt-2">
            Upload a Moodle backup file (.mbz) to import course content, files, and structure
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Moodle Backup File (.mbz)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept=".mbz"
                onChange={handleFileChange}
                className="hidden"
                id="moodle-file"
                disabled={uploading}
              />
              <label
                htmlFor="moodle-file"
                className={`cursor-pointer ${uploading ? 'opacity-50' : ''}`}
              >
                <div className="text-6xl mb-4">📦</div>
                <p className="text-lg font-medium text-gray-700 mb-2">
                  {file ? file.name : 'Choose Moodle Backup File'}
                </p>
                <p className="text-sm text-gray-500">
                  Click to browse or drag and drop your .mbz file
                </p>
                {file && (
                  <p className="text-sm text-green-600 mt-2">
                    ✅ File selected: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </label>
            </div>
          </div>

          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Category *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            >
              <option value="">-- Choose a category --</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Category Selection */}
          {categoryId && filteredSubCategories.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Sub-Category (Optional)
              </label>
              <select
                value={subCategoryId}
                onChange={(e) => setSubCategoryId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={uploading}
              >
                <option value="">-- Choose a sub-category (optional) --</option>
                {filteredSubCategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Progress Bar */}
          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">{status}</span>
                <span className="text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadComplete && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">✅ {status}</p>
              <p className="text-sm text-green-600 mt-1">
                Redirecting to courses...
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 font-medium">❌ {error}</p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || !categoryId || uploading}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all
              ${
                !file || !categoryId || uploading
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}
          >
            {uploading ? 'Importing...' : 'Import Moodle Course'}
          </button>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">📋 What will be imported:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Course title, description, and metadata</li>
              <li>• Course sections/units with content</li>
              <li>• Learning materials (PDFs, videos, documents)</li>
              <li>• Files uploaded to Cloudinary automatically</li>
              <li>• Course structure preserved from Moodle</li>
            </ul>
          </div>
        </div>

        {/* How to Export Guide */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            📖 How to Export from Moodle
          </h2>
          <ol className="space-y-3 text-gray-700">
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">1.</span>
              <span>
                In Moodle, go to your course and click on{' '}
                <strong>Course Administration → Backup</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">2.</span>
              <span>Select the content you want to include (sections, activities, files)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">3.</span>
              <span>Click <strong>Perform backup</strong> and wait for completion</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">4.</span>
              <span>
                Download the generated <strong>.mbz</strong> file
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-blue-600">5.</span>
              <span>Upload it here to import into your LMS</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

