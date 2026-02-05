// Vercel Serverless Function for Notion API
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { token, database_id, original, final, aiSuggestion, intentNote } = req.body;

    if (!token || !database_id) {
        return res.status(400).json({ error: 'Missing Notion credentials' });
    }

    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                parent: { database_id },
                properties: {
                    // Title property - AI Suggestion
                    'Name': {
                        title: [
                            {
                                text: {
                                    content: aiSuggestion || final || ''
                                }
                            }
                        ]
                    },
                    // Original recognition
                    'Original': {
                        rich_text: [
                            {
                                text: {
                                    content: original || ''
                                }
                            }
                        ]
                    },
                    // Final (after corrections)
                    'Final': {
                        rich_text: [
                            {
                                text: {
                                    content: final || ''
                                }
                            }
                        ]
                    },
                    // AI Suggestion
                    'AISuggestion': {
                        rich_text: [
                            {
                                text: {
                                    content: aiSuggestion || ''
                                }
                            }
                        ]
                    },
                    // Intent note (Japanese explanation)
                    'Intent': {
                        rich_text: [
                            {
                                text: {
                                    content: intentNote || ''
                                }
                            }
                        ]
                    },
                    // Date
                    'Date': {
                        date: {
                            start: new Date().toISOString().split('T')[0]
                        }
                    }
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Notion API error:', error);
            return res.status(response.status).json({
                error: error.message || 'Notion API error'
            });
        }

        const data = await response.json();
        return res.status(200).json({ success: true, id: data.id });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
