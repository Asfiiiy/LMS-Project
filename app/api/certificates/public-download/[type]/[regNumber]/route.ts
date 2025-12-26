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
    
    // Get backend URL - for server-side, always use localhost:5000 (backend is on same server)
    // For production VPS, backend runs on localhost:5000
    let backendUrl: string;
    if (process.env.NEXT_PUBLIC_API_URL) {
      backendUrl = process.env.NEXT_PUBLIC_API_URL;
      // If it's HTTPS, convert to HTTP for localhost backend connection
      if (backendUrl.startsWith('https://') && backendUrl.includes('localhost')) {
        backendUrl = backendUrl.replace('https://', 'http://');
      }
    } else {
      // Server-side: backend is always on localhost:5000
      backendUrl = 'http://localhost:5000';
    }
    
    // Ensure it doesn't end with /api (we'll add it)
    if (backendUrl.endsWith('/api')) {
      backendUrl = backendUrl.slice(0, -4);
    }
    
    const fullBackendUrl = `${backendUrl}/api/certificates/public-download/${type}/${regNumber}${viewInline ? '?view=true' : ''}`;
    console.log(`🔗 Proxying to backend: ${fullBackendUrl}`);
    
    let response: Response;
    try {
      response = await fetch(fullBackendUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf,application/json,*/*',
        },
        // Add timeout
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    } catch (fetchError: any) {
      console.error(`❌ Fetch error:`, fetchError);
      return NextResponse.json(
        { success: false, message: `Failed to connect to backend: ${fetchError.message}` },
        { status: 502 }
      );
    }
    
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = 'Backend error';
      try {
        const errorText = await response.text();
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
      } catch (e) {
        errorMessage = `HTTP ${response.status}`;
      }
      console.error(`❌ Backend error: ${response.status} - ${errorMessage}`);
      return NextResponse.json(
        { success: false, message: errorMessage },
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
