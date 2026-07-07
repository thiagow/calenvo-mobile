-- CreateTable
CREATE TABLE "ChatWidgetConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Olá! Como posso ajudar a agendar seu horário?',
    "primaryColor" TEXT NOT NULL DEFAULT '#7C3AED',
    "position" TEXT NOT NULL DEFAULT 'bottom-right',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatWidgetConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatWidgetConfig_userId_key" ON "ChatWidgetConfig"("userId");

-- AddForeignKey
ALTER TABLE "ChatWidgetConfig" ADD CONSTRAINT "ChatWidgetConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
