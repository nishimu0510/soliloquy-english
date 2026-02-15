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

    const { token, database_id, original, final, aiSuggestion, aiExplanation, intentNote } = req.body;

    if (!token || !database_id) {
        return res.status(400).json({ error: 'Missing Notion credentials' });
    }

    try {
        // 日本時間で今日の日付を取得 (YYYYMMDD形式)
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000; // UTC+9
        const jstDate = new Date(now.getTime() + jstOffset);
        const dateStr = jstDate.toISOString().split('T')[0]; // 2026-02-06
        const dateName = dateStr.replace(/-/g, ''); // 20260206

        // 今日のエントリ数を取得して連番を決定（Nameプレフィックスで検索）
        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${database_id}/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: JSON.stringify({
                filter: {
                    property: 'Name',
                    title: {
                        starts_with: dateName + '_'
                    }
                }
            })
        });

        let count = 1;
        if (queryResponse.ok) {
            const queryData = await queryResponse.json();
            count = queryData.results.length + 1;
        }

        // 連番を2桁でフォーマット (01, 02, ...)
        const entryName = `${dateName}_${String(count).padStart(2, '0')}`;

        // OriginalとFinalが同じ場合はOriginalを空にする
        const showOriginal = original && original !== final ? original : '';

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
                    // Title property - 日付_連番
                    'Name': {
                        title: [
                            {
                                text: {
                                    content: entryName
                                }
                            }
                        ]
                    },
                    // Original recognition (空の場合はFinalと同じ)
                    'Original': {
                        rich_text: [
                            {
                                text: {
                                    content: showOriginal
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
                    // AI explanation (why the suggestion was made)
                    'Memo': {
                        rich_text: [
                            {
                                text: {
                                    content: aiExplanation || ''
                                }
                            }
                        ]
                    },
                    // Date (with time)
                    'Date': {
                        date: {
                            start: new Date().toISOString()
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
