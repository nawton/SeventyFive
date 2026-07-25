-- REALTID FÖR MEDDELANDEN: chatten prenumererar på postgres_changes, men
-- direct_messages lades aldrig till i publikationen — utan den raden sänds
-- inga händelser och mottagaren fick vänta på nästa fokusladdning.
-- RLS gäller även i realtidsflödet: bara parterna ser sina meddelanden.

ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
