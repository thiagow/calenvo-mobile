'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';

interface Variable {
  name: string;
  description: string;
  example: string;
}

const AVAILABLE_VARIABLES: Variable[] = [
  {
    name: '{{nome_cliente}}',
    description: 'Nome do cliente',
    example: 'João Silva',
  },
  {
    name: '{{data}}',
    description: 'Data do agendamento',
    example: '25/01/2026',
  },
  {
    name: '{{hora}}',
    description: 'Horário do agendamento',
    example: '14:00',
  },
  {
    name: '{{servico}}',
    description: 'Nome do serviço',
    example: 'Corte de Cabelo',
  },
  {
    name: '{{profissional}}',
    description: 'Nome do profissional',
    example: 'Dr. João',
  },
  {
    name: '{{empresa}}',
    description: 'Nome da empresa',
    example: 'Minha Empresa',
  },
];

interface VariableHelperProps {
  onInsert?: (variable: string) => void;
}

export function VariableHelper({ onInsert }: VariableHelperProps) {
  const handleVariableClick = (variable: string) => {
    if (onInsert) {
      onInsert(variable);
    } else {
      // Copy to clipboard as fallback
      navigator.clipboard.writeText(variable);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <HelpCircle className="h-4 w-4 mr-2" />
          Variáveis Disponíveis
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-sm mb-2">Variáveis Personalizadas</h4>
            <p className="text-xs text-muted-foreground mb-3">
              Clique em uma variável para copiar ou inseri-la na mensagem
            </p>
          </div>

          <div className="space-y-2">
            {AVAILABLE_VARIABLES.map((variable) => (
              <button
                key={variable.name}
                type="button"
                onClick={() => handleVariableClick(variable.name)}
                className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors"
              >
                <div className="font-mono text-sm text-primary font-medium">
                  {variable.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {variable.description}
                </div>
                <div className="text-xs text-muted-foreground italic mt-0.5">
                  Ex: {variable.example}
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 border-t text-xs text-muted-foreground">
            <p>As variáveis serão substituídas automaticamente no momento do envio.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
