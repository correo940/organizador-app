'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircleIcon as WhatsApp } from 'lucide-react';
import { GenerateCardDialog } from '@/components/apps/mi-hogar/confessions/generate-card-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Props = {
    thought: {
        id: string;
        share_token: string;
        is_anonymous: boolean;
        creator_name: string | null;
    };
    onClose: () => void;
};

export function ShareDialog({ thought, onClose }: Props) {
    const [copied, setCopied] = useState(false);
    const [showCardDialog, setShowCardDialog] = useState(false);

    const shareUrl = `${window.location.origin}/thought/${thought.share_token}`;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success('Enlace copiado');
        setTimeout(() => setCopied(false), 2000);
    };

    const shareWhatsApp = () => {
        const text = 'Alguien compartió un pensamiento contigo 🤔';
        window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n\n' + shareUrl)}`);
    };

    const shareEmail = () => {
        const subject = 'Un pensamiento para ti';
        const body = `Alguien compartió un pensamiento contigo:\n\n${shareUrl}`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const shareTelegram = () => {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`);
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Compartir Pensamiento</DialogTitle>
                    <DialogDescription>
                        Comparte este enlace para que alguien pueda ver y responder a tu pensamiento
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* URL Display */}
                    <div className="flex gap-2">
                        <Input
                            value={shareUrl}
                            readOnly
                            className="font-mono text-sm"
                        />
                        <Button onClick={copyToClipboard} size="icon" variant="outline">
                            {copied ? (
                                <Check className="w-4 h-4 text-green-600" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </Button>
                    </div>

                    {/* Share buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={shareWhatsApp}
                            variant="outline"
                            className="w-full"
                        >
                            <WhatsApp className="w-4 h-4 mr-2" />
                            WhatsApp
                        </Button>

                        <Button
                            onClick={shareEmail}
                            variant="outline"
                            className="w-full"
                        >
                            ✉️ Email
                        </Button>

                        <Button
                            onClick={shareTelegram}
                            variant="outline"
                            className="w-full col-span-2"
                        >
                            📲 Telegram
                        </Button>
                    </div>

                    {/* Generate Card Button */}
                    <div className="pt-2 border-t">
                        <Button
                            onClick={() => setShowCardDialog(true)}
                            variant="secondary"
                            className="w-full bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 hover:from-violet-500/20 hover:to-fuchsia-500/20 border-violet-200"
                        >
                            ✨ Generar Tarjeta de Regalo
                        </Button>
                    </div>

                    {/* Info */}
                    <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground">
                        <p>
                            El receptor podrá ver y responder a tu pensamiento sin necesidad de tener una cuenta en Quioba.
                        </p>
                        {thought.is_anonymous && (
                            <p className="mt-2 font-medium">
                                ℹ️ Este pensamiento es anónimo
                            </p>
                        )}
                    </div>
                </div>
            </DialogContent>

            {showCardDialog && (
                <GenerateCardDialog
                    isOpen={showCardDialog}
                    onClose={() => setShowCardDialog(false)}
                    thought={thought}
                />
            )}
        </Dialog>
    );
}
