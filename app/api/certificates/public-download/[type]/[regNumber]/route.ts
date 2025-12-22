import { NextRequest, NextResponse } from 'next/server';

/**
 * Public certificate download API route (Next.js proxy to backend)
 * GET /api/certificates/public-download/cert/ILC50029
 * GET /api/certificates/public-download/trans/ILC50029
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; regNumber: string }> }
) {
  try {
    const { type, regNumber } = await params;
    
    // DEBUG: Log what we received
    console.log('🔍 DEBUG - Received params:', { type, regNumber });
    console.log('🔍 DEBUG - Type validation:', type, 'is valid:', ['cert', 'trans'].includes(type));
    
    // Validate parameters
    if (!['cert', 'trans'].includes(type)) {
      console.log('❌ DEBUG - Invalid type received:', type);
      return NextResponse.json(
        { success: false, message: `Invalid certificate type: '${type}'. Expected 'cert' or 'trans'` },
        { status: 400 }
      );
    }
    
    if (!regNumber) {
      return NextResponse.json(
        { success: false, message: 'Registration number required' },
        { status: 400 }
      );
    }
    
    // Check if user wants to view inline
    const viewInline = request.nextUrl.searchParams.get('view') === 'true';
    
    console.log(`📥 Frontend proxy ${viewInline ? 'view' : 'download'} request: ${type} for ${regNumber}`);
    
    // Proxy request to backend
    const backendUrl = `http://localhost:5000/api/certificates/public-download/${type}/${regNumber}${viewInline ? '?view=true' : ''}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Backend error: ${response.status}`, errorData);
      return NextResponse.json(
        { success: false, message: errorData.message || 'Backend error' },
        { status: response.status }
      );
    }
    
    // Check if response is JSON (error) or binary (PDF)
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      // It's an error response
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }
    
    // It's a file download - stream it through
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Get disposition and filename from backend headers
    const backendDisposition = response.headers.get('content-disposition');
    const filename = backendDisposition?.match(/filename="(.+)"/)?.[1] || 
                    `${type === 'cert' ? 'Certificate' : 'Transcript'}_${regNumber}.pdf`;
    
    // Use the same disposition type as backend (inline for view, attachment for download)
    const dispositionType = viewInline ? 'inline' : 'attachment';
    
    console.log(`✅ Proxying file ${viewInline ? 'view' : 'download'}: ${filename} (${buffer.length} bytes)`);
    
    // Build headers object
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', contentType || 'application/pdf');
    responseHeaders.set('Content-Length', buffer.length.toString());
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');
    
    // For inline viewing of PDFs, omit Content-Disposition to let browser handle it
    if (viewInline && contentType === 'application/pdf') {
      console.log(`   ✅ Omitting Content-Disposition for inline PDF viewing`);
      // Don't set Content-Disposition - browser will display inline by default
    } else {
      responseHeaders.set('Content-Disposition', `${dispositionType}; filename="${filename}"`);
      console.log(`   Content-Disposition: ${dispositionType}; filename="${filename}"`);
    }
    
    // Return the file with proper headers
    return new NextResponse(buffer, {
      status: 200,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('Frontend proxy error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
