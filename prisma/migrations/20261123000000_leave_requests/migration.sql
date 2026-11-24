CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "reviewedById" TEXT,
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Shift" ADD COLUMN "leaveRequestId" TEXT, ADD COLUMN "leaveAction" TEXT;
CREATE INDEX "LeaveRequest_userId_status_startDate_endDate_idx" ON "LeaveRequest"("userId", "status", "startDate", "endDate");
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
