import { Request, Response, NextFunction } from 'express';
import { requireAdminOnly } from '../../../src/middleware/role.middleware';

const response = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe('requireAdminOnly', () => {
  it('rejects managers from privilege-changing user operations', () => {
    const req = { user: { id: 'manager-1', role: 'manager' } } as unknown as Request;
    const res = response();
    const next = jest.fn() as NextFunction;

    requireAdminOnly(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows administrators', () => {
    const req = { user: { id: 'admin-1', role: 'admin' } } as unknown as Request;
    const res = response();
    const next = jest.fn() as NextFunction;

    requireAdminOnly(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
