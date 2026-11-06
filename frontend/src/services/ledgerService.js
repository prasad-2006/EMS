import api from './api';

export const getLedgerEntries = () => api.get('/ledger');
