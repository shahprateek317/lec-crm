-- Track when coordinator added member to the WhatsApp group
ALTER TABLE "MeditationGroupMembership" ADD COLUMN "whatsappGroupAddedAt" TIMESTAMP(3);
