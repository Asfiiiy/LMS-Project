# Certificate & Transcript – URLs and Workflow

## Two different URL types

| Purpose | URL pattern | Auth | What is served |
|--------|-------------|------|----------------|
| **Admin view (before/after delivery)** | `https://lms.inspirelondoncollege.com/api/certificates/generated/{id}/file/transcript?token=JWT&view=true` | JWT in query | File from DB: `transcript_docx_path` (or PDF if stored). Used e.g. in Office Online viewer. |
| **Student / public view (after delivery only)** | `https://lms.inspirelondoncollege.com/api/certificates/public-download/trans/{REG_NUMBER}?view=true` | None (public by reg number) | File from DB: `transcript_pdf_path` first, else `transcript_docx_path`. |

- **Admin URL** uses **certificate id** (e.g. `60`) and **token**.
- **Student URL** uses **registration number** (e.g. `ILC50050`) and is **public** (no token).

Both must point at the **same** underlying file once you’ve uploaded your edited transcript and delivered.

---

## Full workflow (edit in Word → student sees clean layout)

### 1. Admin: get current transcript (by certificate id)

- **Download DOCX**  
  - Backend: `GET /api/certificates/generated/{id}/docx/trans` (auth header).  
  - Serves file at `generated_certificates.transcript_docx_path` (e.g. `uploads/certificates/generated/212/transcript_ILC-130.docx`).

### 2. Admin: edit in Word and re-upload

- **Upload DOCX**  
  - Backend: `POST /api/certificates/generated/{id}/upload-docx/trans` (auth, body: `file` = your .docx).  
  - Saves file to: `backend/uploads/certificates/generated/{student_id}/transcript_{registration_number}.docx`.  
  - DB: sets `transcript_docx_path` to that path; sets `transcript_pdf_path` and `transcript_pdf_url` to `NULL`.

### 3. Admin: optional reconvert to PDF

- **Reconvert**  
  - Backend: `POST /api/certificates/generated/{id}/reconvert/trans` (auth).  
  - Reads DOCX at `transcript_docx_path`, converts to PDF, saves next to the DOCX, updates `transcript_pdf_path`.

### 4. Admin: deliver to student

- **Deliver**  
  - Backend: `POST /api/certificates/generated/{id}/deliver` (auth).  
  - If PDF missing: reads DOCX at `transcript_docx_path`, converts to PDF, saves in same folder (e.g. `.../transcript_ILC-130.pdf`).  
  - DB: sets `transcript_pdf_url` = public URL, `transcript_pdf_path` = that PDF path, `status = 'delivered'`.

### 5. Student / public view (must stay correct over time)

- **Public link**  
  - `https://lms.inspirelondoncollege.com/api/certificates/public-download/trans/{REG_NUMBER}?view=true`  
  - Backend: `GET /api/certificates/public-download/trans/:regNumber`.  
  - Looks up row: `registration_number = REG_NUMBER` and `status = 'delivered'`.  
  - Serves file: **first** `transcript_pdf_path`, **else** `transcript_docx_path`.  
  - This is the URL the student uses; it must always serve the PDF/DOCX you created from your **uploaded** transcript.

---

## Why the layout was “disturbed” later

Two causes were fixed:

1. **Save placeholders (Edit Cert / Edit Trans form)**  
   - Previously: saving triggered **regeneration from template** and overwrote `transcript_docx_path` and PDF paths.  
   - **Now:** saving only updates placeholder data in the DB; it **does not** change docx/pdf paths or regenerate files. Your uploaded transcript and its PDF are left as-is.

2. **Regeneration overwriting delivered files**  
   - If something called the generator again for an already-delivered certificate, it could overwrite paths with template-generated files.  
   - **Now:** if the certificate is already `delivered`, the generator **does not** overwrite `certificate_docx_path`, `transcript_docx_path`, or pdf paths; it only updates `generated_data` / `registration_number` if needed.

So:

- **Admin URL** (`/api/certificates/generated/60/file/transcript?token=...`) always uses `transcript_docx_path` (your uploaded file).  
- **Student URL** (`/api/certificates/public-download/trans/ILC50050?view=true`) uses `transcript_pdf_path` (or docx) set at **delivery** time, and that path is no longer overwritten by “Save placeholders” or by regeneration once status is `delivered`.

---

## Where things are stored (backend)

| Item | Location |
|------|----------|
| Uploaded / edited DOCX | `backend/uploads/certificates/generated/{student_id}/transcript_{REG}.docx` |
| PDF created on delivery (or reconvert) | Same folder, e.g. `.../transcript_{REG}.pdf` |
| DB paths | `generated_certificates.transcript_docx_path`, `transcript_pdf_path` (relative to backend root) |

---

## Quick checklist

- After you **upload** the new transcript: `transcript_docx_path` points to your file; pdf path is cleared.  
- After you **deliver**: `transcript_pdf_path` and `transcript_pdf_url` are set from the PDF built from that DOCX.  
- Do **not** use “Edit Cert / Edit Trans” **Save** if you only changed layout in Word; that form is for text/placeholders only. For layout, use Download → Word → Upload → (Reconvert) → Deliver.  
- Restart backend after code changes so the new behaviour is active.
