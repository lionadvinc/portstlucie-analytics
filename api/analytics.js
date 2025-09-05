// api/analytics.js - Vercel serverless function (CommonJS format)
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Configuration
const PROPERTY_ID = '455753973';

// Service account credentials from environment variable
const getCredentials = () => {
    try {
        return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT || '{}');
    } catch (error) {
        console.error('Failed to parse service account credentials:', error);
        return null;
    }
};

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const credentials = getCredentials();
        
        if (!credentials || !credentials.client_email) {
            throw new Error('Invalid or missing Google service account credentials');
        }

        // Initialize Google Analytics client
        const analyticsDataClient = new BetaAnalyticsDataClient({
            credentials: credentials,
        });

        // Get real-time active users
        const [realtimeResponse] = await analyticsDataClient.runRealtimeReport({
            property: `properties/${PROPERTY_ID}`,
            metrics: [
                { name: 'activeUsers' },
            ],
            dimensions: [
                { name: 'country' },
                { name: 'city' },
            ],
        });

        // Get today's data
        const [todayResponse] = await analyticsDataClient.runReport({
            property: `properties/${PROPERTY_ID}`,
            dateRanges: [
                {
                    startDate: 'today',
                    endDate: 'today',
                },
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'screenPageViews' },
            ],
        });

        // Process real-time data
        let liveVisitors = 0;
        const recentActivity = [];
        
        if (realtimeResponse.rows) {
            realtimeResponse.rows.forEach(row => {
                const activeUsers = parseInt(row.metricValues[0].value) || 0;
                const country = row.dimensionValues[0].value || 'Unknown';
                const city = row.dimensionValues[1].value || 'Unknown';
                
                liveVisitors += activeUsers;
                
                if (recentActivity.length < 5 && activeUsers > 0) {
                    recentActivity.push({
                        location: `${city}, ${country}`,
                        time: Math.floor(Math.random() * 10) + 1
                    });
                }
            });
        }

        // Process today's data
        let todayVisits = 0;
        let pageViews = 0;
        
        if (todayResponse.rows) {
            todayResponse.rows.forEach(row => {
                todayVisits += parseInt(row.metricValues[0].value) || 0;
                pageViews += parseInt(row.metricValues[1].value) || 0;
            });
        }

        // Return response
        res.status(200).json({
            liveVisitors,
            todayVisits,
            pageViews,
            recentActivity,
            lastUpdated: new Date().toISOString(),
            status: 'success'
        });

    } catch (error) {
        console.error('Analytics API Error:', error);
        res.status(500).json({
            error: 'Failed to fetch analytics data',
            message: error.message,
            status: 'error'
        });
    }
};