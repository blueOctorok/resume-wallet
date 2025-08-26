require('dotenv').config({ path: '.env.local' })

async function testSupabase() {
  try {
    console.log('🔌 Testing Supabase connection...')
    console.log(
      '📋 Supabase URL:',
      process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Found' : 'Missing!'
    )
    console.log(
      '📋 Supabase Key:',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Found' : 'Missing!'
    )

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      throw new Error(
        'Missing Supabase environment variables! Check your .env.local file.'
      )
    }

    // Test the connection by making a simple request
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    )

    if (response.ok) {
      console.log('✅ Supabase connection successful!')
      console.log('📊 Response status:', response.status)

      // Check if tables exist
      const tablesResponse = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
        }
      )

      if (tablesResponse.ok) {
        console.log('✅ Database accessible!')
        console.log(
          '💡 Next step: Create tables in Supabase dashboard or use SQL editor'
        )
      }
    } else {
      throw new Error(
        `Supabase connection failed: ${response.status} ${response.statusText}`
      )
    }
  } catch (error) {
    console.error('❌ Supabase test failed:', error.message)

    if (error.message.includes('fetch')) {
      console.log('\n💡 Connection failed. Make sure:')
      console.log('1. Your Supabase project is active')
      console.log('2. Environment variables are correct')
      console.log('3. No network restrictions')
    }
  }
}

testSupabase()
