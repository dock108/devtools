-- Add table to track processed event buffer IDs for idempotency
BEGIN;

CREATE TABLE IF NOT EXISTS public.processed_event_buffer_ids (
    event_buffer_id BIGINT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT processed_event_buffer_ids_pkey PRIMARY KEY (event_buffer_id)
    -- Optional: Add foreign key if desired and if event_buffer.id is stable
    -- CONSTRAINT processed_event_buffer_ids_event_buffer_id_fkey FOREIGN KEY (event_buffer_id) REFERENCES public.event_buffer(id) ON DELETE CASCADE
);

-- Add comments
COMMENT ON TABLE public.processed_event_buffer_ids IS 'Tracks event_buffer records that have been successfully processed by the guardian-reactor to ensure idempotency.';
COMMENT ON COLUMN public.processed_event_buffer_ids.event_buffer_id IS 'The ID from the event_buffer table.';
COMMENT ON COLUMN public.processed_event_buffer_ids.processed_at IS 'Timestamp when the event processing was completed (or marked as processed).';

COMMIT; 