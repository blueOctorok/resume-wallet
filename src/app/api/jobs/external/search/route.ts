import { NextRequest, NextResponse } from 'next/server';

/**
 * Adzuna Job Search API Proxy
 * 
 * This endpoint proxies requests to the Adzuna API to keep our API keys secure.
 * Adzuna provides access to thousands of job listings from various sources.
 * 
 * Docs: https://developer.adzuna.com/
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get search parameters
    const keywords = searchParams.get('keywords') || 'truck driver CDL';
    const location = searchParams.get('location') || '';
    const page = searchParams.get('page') || '1';
    const resultsPerPage = searchParams.get('results_per_page') || '20';
    const sortBy = searchParams.get('sort_by') || 'date'; // date, relevance, salary
    
    // Get Adzuna credentials from env
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    
    console.log('🔑 [JOB API] Environment check:', {
      hasAppId: !!appId,
      hasAppKey: !!appKey,
      appIdLength: appId?.length || 0,
      appKeyLength: appKey?.length || 0,
    });
    
    if (!appId || !appKey) {
      console.error('❌ Adzuna API credentials not configured', {
        ADZUNA_APP_ID: appId ? 'SET' : 'MISSING',
        ADZUNA_APP_KEY: appKey ? 'SET' : 'MISSING',
      });
      return NextResponse.json(
        { 
          error: 'Job search service not configured',
          debug: process.env.NODE_ENV === 'development' ? {
            ADZUNA_APP_ID: appId ? 'SET' : 'MISSING',
            ADZUNA_APP_KEY: appKey ? 'SET' : 'MISSING',
          } : undefined
        },
        { status: 500 }
      );
    }
    
    // Build Adzuna API URL (US jobs)
    const adzunaUrl = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${page}`);
    adzunaUrl.searchParams.set('app_id', appId);
    adzunaUrl.searchParams.set('app_key', appKey);
    adzunaUrl.searchParams.set('results_per_page', resultsPerPage);
    adzunaUrl.searchParams.set('what', keywords);
    adzunaUrl.searchParams.set('content-type', 'application/json');
    
    if (location) {
      adzunaUrl.searchParams.set('where', location);
    }
    
    // Sort by parameter
    if (sortBy === 'date') {
      adzunaUrl.searchParams.set('sort_by', 'date');
    } else if (sortBy === 'salary') {
      adzunaUrl.searchParams.set('sort_by', 'salary');
    }
    
    console.log('🔍 Fetching jobs from Adzuna:', {
      keywords,
      location,
      page,
      resultsPerPage,
      sortBy,
      url: adzunaUrl.toString().replace(appKey, '***') // Hide API key in logs
    });
    
    // Fetch from Adzuna
    const response = await fetch(adzunaUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log('📡 [JOB API] Adzuna response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Adzuna API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: adzunaUrl.toString().replace(appKey, '***')
      });
      return NextResponse.json(
        { 
          error: 'Failed to fetch jobs from external service',
          statusCode: response.status,
          details: process.env.NODE_ENV === 'development' ? errorText : undefined
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    console.log('📦 [JOB API] Adzuna data structure:', {
      hasResults: !!data.results,
      resultsIsArray: Array.isArray(data.results),
      resultsLength: data.results?.length || 0,
      hasCount: !!data.count,
    });
    
    // Transform the response to a cleaner format
    console.log('🔄 [JOB API] Starting transformation...');
    
    const transformedResults = data.results?.map((job: any) => ({
      id: job.id,
      title: job.title,
      company: job.company?.display_name || 'Company not listed',
      location: job.location?.display_name || 'Location not specified',
      description: job.description,
      salary: job.salary_min && job.salary_max 
        ? `$${Math.round(job.salary_min).toLocaleString()} - $${Math.round(job.salary_max).toLocaleString()}`
        : job.salary_min 
          ? `$${Math.round(job.salary_min).toLocaleString()}+`
          : null,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      created: job.created,
      redirect_url: job.redirect_url,
      category: job.category?.label || 'Other',
      contract_type: job.contract_type || null,
      is_external: true, // Flag to indicate this is an aggregated job
    })) || [];
    
    console.log('✅ [JOB API] Jobs transformed successfully:', {
      count: transformedResults.length,
      total: data.count || 0
    });
    
    return NextResponse.json({
      success: true,
      results: transformedResults,
      count: data.count || 0,
      page: parseInt(page),
      results_per_page: parseInt(resultsPerPage),
    });
    
  } catch (error) {
    console.error('❌ [JOB API] Unexpected error:', error);
    console.error('❌ [JOB API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? {
          stack: error instanceof Error ? error.stack : undefined,
          error: String(error)
        } : undefined
      },
      { status: 500 }
    );
  }
}

