-- Production may already contain this sequence from the verified manual fix.
-- Never restart it or modify previously issued invoice numbers.
CREATE SEQUENCE IF NOT EXISTS "bank_invoice_number_seq"
    AS BIGINT
    START WITH 10001
    INCREMENT BY 1
    MINVALUE 10001
    MAXVALUE 99999
    NO CYCLE;
