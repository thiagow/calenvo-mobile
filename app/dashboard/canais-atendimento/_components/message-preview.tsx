'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';

interface MessagePreviewProps {
  message: string;
  title?: string;
}

const EXAMPLE_VALUES = {
  '{{nome_cliente}}': 'João Silva',
  '{{data}}': '25/01/2026',
  '{{hora}}': '14:00',
  '{{servico}}': 'Corte de Cabelo',
  '{{profissional}}': 'Dr. João',
  '{{empresa}}': 'Minha Empresa',
};

export function MessagePreview({ message, title = 'Prévia da Mensagem' }: MessagePreviewProps) {
  // Replace variables with example values
  const previewMessage = Object.entries(EXAMPLE_VALUES).reduce(
    (acc, [variable, value]) => acc.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value),
    message || ''
  );

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
          <Eye className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="whitespace-pre-wrap text-sm text-slate-900">
            {previewMessage || (
              <span className="text-muted-foreground italic">
                Digite uma mensagem para visualizar a prévia...
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Esta é uma prévia com valores de exemplo. As variáveis serão substituídas por dados reais no envio.
        </p>
      </CardContent>
    </Card>
  );
}
