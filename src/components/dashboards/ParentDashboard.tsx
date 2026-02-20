"use client";

import { approveTransaction, rejectTransaction } from "@/lib/actions";
import { useTransition } from "react";

export default function ParentDashboard({ profile, pendingApprovals }: { profile: any, pendingApprovals: any[] }) {
    return (
        <div className="space-y-8">

            {/* Approvals Section */}
            <section>
                <div className="flex items-center gap-3 mb-6">
                    <div className="text-2xl">🔔</div>
                    <h2 className="text-xl font-bold text-white">Pendientes de Aprobación</h2>
                    {pendingApprovals.length > 0 && (
                        <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">{pendingApprovals.length}</span>
                    )}
                </div>

                {pendingApprovals.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
                        <div className="text-4xl mb-4">✅</div>
                        <p className="text-gray-400">Todo está al día. ¡Buen trabajo!</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pendingApprovals.map((item) => (
                            <ApprovalCard key={item.id} item={item} />
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
}

function ApprovalCard({ item }: { item: any }) {
    const [isPending, startTransition] = useTransition();

    const handleApprove = () => {
        startTransition(async () => {
            await approveTransaction(item.id, item.kid_id, item.amount);
        });
    };

    const handleReject = () => {
        if (!confirm("¿Rechazar esta solicitud?")) return;
        startTransition(async () => {
            await rejectTransaction(item.id);
        });
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <div className="text-3xl">{item.profiles?.avatar_url || "👤"}</div>
                <div>
                    <div className="font-bold text-white text-lg">
                        {item.profiles?.full_name}: <span className="text-gray-300 font-normal">{item.description}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                        Hace un momento • <span className={item.amount > 0 ? "text-teal-400" : "text-orange-400 font-bold"}>
                            {item.amount > 0 ? `+${item.amount}` : item.amount} PTS
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleReject}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 font-bold text-sm hover:bg-red-500/20 disabled:opacity-50"
                >
                    ✗ Rechazar
                </button>
                <button
                    onClick={handleApprove}
                    disabled={isPending}
                    className="px-6 py-2 rounded-xl bg-teal-500 text-white font-bold text-sm hover:bg-teal-600 disabled:opacity-50 shadow-lg shadow-teal-500/20"
                >
                    {isPending ? "..." : "✓ Aprobar"}
                </button>
            </div>
        </div>
    )
}
