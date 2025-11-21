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
    
    if (!appId || !appKey) {
      console.error('❌ Adzuna API credentials not configured');
      return NextResponse.json(
        { error: 'Job search service not configured' },
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
      sortBy
    });
    
    // Fetch from Adzuna
    const response = await fetch(adzunaUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Adzuna API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return NextResponse.json(
        { error: 'Failed to fetch jobs from external service' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    
    console.log('✅ Jobs fetched successfully:', {
      count: data.results?.length || 0,
      total: data.count || 0
    });
    
    // Transform the response to a cleaner format
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
    
    return NextResponse.json({
      success: true,
      results: transformedResults,
      count: data.count || 0,
      page: parseInt(page),
      results_per_page: parseInt(resultsPerPage),
    });
    
  } catch (error) {
    console.error('❌ Error in job search API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

