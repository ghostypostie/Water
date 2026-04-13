import 'dotenv/config';

interface GitHubContentResponse {
    success: boolean;
    content?: string;
    error?: string;
}

export async function fetchGitHubContent(path: string): Promise<GitHubContentResponse> {
    // Hardcoded credentials for renderer process (can't access process.env)
    const token = '';
    const repo = '';

    if (!token || !repo) {
        console.error('[GitHub] Token or repo not configured');
        return { success: false, error: 'GitHub credentials not configured' };
    }

    try {
        const url = `https://api.github.com/repos/${repo}/contents/${path}`;
        
        console.log('[GitHub] Fetching:', url);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3.raw',
                'User-Agent': 'Water-Client'
            }
        });

        if (!response.ok) {
            console.error('[GitHub] Fetch failed:', response.status, response.statusText);
            return { success: false, error: `GitHub API error: ${response.status}` };
        }

        const content = await response.text();
        console.log('[GitHub] Successfully fetched content, length:', content.length);
        return { success: true, content };

    } catch (error) {
        console.error('[GitHub] Fetch error:', error);
        return { success: false, error: String(error) };
    }
}

export async function fetchGitHubJSON(path: string): Promise<any> {
    const result = await fetchGitHubContent(path);
    if (result.success && result.content) {
        try {
            return JSON.parse(result.content);
        } catch (e) {
            console.error('[GitHub] JSON parse error:', e);
            return null;
        }
    }
    return null;
}
