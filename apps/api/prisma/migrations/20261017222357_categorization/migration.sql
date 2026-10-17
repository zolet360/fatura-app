-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('SYSTEM_RULE', 'USER_RULE', 'MANUAL');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "categorySource" "CategorySource",
ADD COLUMN     "merchantKey" TEXT NOT NULL DEFAULT '';
-- Transações já existentes ficam com chave vazia até rodar `npm run db:recategorize -w api`,
-- que calcula a chave a partir da descrição (a normalização vive no código, não dá para fazer em SQL).
ALTER TABLE "transactions" ALTER COLUMN "merchantKey" DROP DEFAULT;

-- CreateTable
CREATE TABLE "category_rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_rules_userId_merchantKey_key" ON "category_rules"("userId", "merchantKey");

-- CreateIndex
CREATE INDEX "transactions_merchantKey_idx" ON "transactions"("merchantKey");

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rules" ADD CONSTRAINT "category_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
