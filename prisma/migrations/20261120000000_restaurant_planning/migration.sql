CREATE TYPE "ReplacementStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'ANNULEE');

CREATE TABLE "RestaurantSlot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "closedDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RestaurantSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RestaurantClosure" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RestaurantClosure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftReplacementRequest" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "proposedUserId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "ReplacementStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftReplacementRequest_pkey" PRIMARY KEY ("id")
);

INSERT INTO "RestaurantSlot" ("id", "name", "startTime", "endTime", "sortOrder", "closedDays", "updatedAt") VALUES
    ('slot-preparation', 'Préparation', '08:00', '11:00', 0, ARRAY[6, 7]::INTEGER[], CURRENT_TIMESTAMP),
    ('slot-midi-1', 'Midi 1', '11:00', '15:00', 1, ARRAY[]::INTEGER[], CURRENT_TIMESTAMP),
    ('slot-midi-2', 'Midi 2', '11:00', '15:00', 2, ARRAY[]::INTEGER[], CURRENT_TIMESTAMP),
    ('slot-soir-1', 'Soir 1', '18:00', '22:00', 3, ARRAY[]::INTEGER[], CURRENT_TIMESTAMP),
    ('slot-soir-2', 'Soir 2', '18:00', '22:00', 4, ARRAY[]::INTEGER[], CURRENT_TIMESTAMP),
    ('slot-admin', 'Admin', '08:00', '11:00', 5, ARRAY[6, 7]::INTEGER[], CURRENT_TIMESTAMP);

ALTER TABLE "Shift" ADD COLUMN "slotId" TEXT;

CREATE INDEX "RestaurantSlot_isActive_sortOrder_idx" ON "RestaurantSlot"("isActive", "sortOrder");
CREATE UNIQUE INDEX "RestaurantClosure_slotId_date_key" ON "RestaurantClosure"("slotId", "date");
CREATE INDEX "RestaurantClosure_date_idx" ON "RestaurantClosure"("date");
CREATE INDEX "ShiftReplacementRequest_shiftId_status_idx" ON "ShiftReplacementRequest"("shiftId", "status");
CREATE INDEX "ShiftReplacementRequest_proposedUserId_status_idx" ON "ShiftReplacementRequest"("proposedUserId", "status");
CREATE INDEX "Shift_slotId_startTime_idx" ON "Shift"("slotId", "startTime");

ALTER TABLE "RestaurantClosure"
    ADD CONSTRAINT "RestaurantClosure_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "RestaurantSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftReplacementRequest"
    ADD CONSTRAINT "ShiftReplacementRequest_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ShiftReplacementRequest_proposedUserId_fkey"
    FOREIGN KEY ("proposedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ShiftReplacementRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shift"
    ADD CONSTRAINT "Shift_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "RestaurantSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
