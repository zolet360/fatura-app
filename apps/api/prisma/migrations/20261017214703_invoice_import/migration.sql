-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('PURCHASE', 'REFUND', 'IOF', 'FEE', 'PAYMENT');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "closingDate" DATE NOT NULL,
ADD COLUMN     "fileHash" TEXT,
ADD COLUMN     "periodEnd" DATE NOT NULL,
ADD COLUMN     "periodStart" DATE NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "dueDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "foreignAmountCents" INTEGER,
ADD COLUMN     "foreignCurrency" TEXT,
ADD COLUMN     "kind" "TransactionKind" NOT NULL,
ADD COLUMN     "position" INTEGER NOT NULL,
ALTER COLUMN "date" SET DATA TYPE DATE;
