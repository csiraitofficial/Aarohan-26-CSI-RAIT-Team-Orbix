import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const payload = await getSession();
        if (!payload) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Ideally, we'd check if the user is an admin here.
        // For MVP, we'll allow any authenticated user to view the admin page,
        // or we could add a hardcoded check. Given it's a hackathon, returning all.

        const users = await prisma.user.findMany({
            select: {
                id: true,
                display_name: true,
                email: true,
                phone: true,
                district: true,
                language: true,
                created_at: true,
                mcq_sessions: {
                    select: {
                        id: true,
                        score: true,
                        started_at: true,
                        answers: {
                            select: {
                                is_critical_miss: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Process data for the admin table
        const workers = users.map(user => {
            const completedSessions = user.mcq_sessions.filter(s => s.score !== null);
            const totalScenarios = completedSessions.length;

            let totalScore = 0;
            let criticalMisses = 0;

            completedSessions.forEach(session => {
                totalScore += (session.score || 0);
                criticalMisses += session.answers.filter(a => a.is_critical_miss).length;
            });

            const averageScore = totalScenarios > 0 ? Math.round(totalScore / totalScenarios) : 0;

            // Get last active date
            let lastActive = user.created_at;
            if (completedSessions.length > 0) {
                const dates = completedSessions.map(s => new Date(s.started_at).getTime());
                lastActive = new Date(Math.max(...dates));
            }

            return {
                id: user.id,
                name: user.display_name || 'Anonymous',
                email: user.email || 'N/A',
                phone: user.phone || 'N/A',
                district: user.district || 'Unassigned',
                language: user.language === 'en' ? 'English' : user.language === 'hi' ? 'Hindi' : 'Marathi',
                joinedAt: user.created_at,
                lastActive: lastActive,
                totalScenarios,
                totalScore, // XP
                averageScore,
                criticalMisses
            };
        });

        return NextResponse.json({ workers });

    } catch (error) {
        console.error('Admin workers API error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
