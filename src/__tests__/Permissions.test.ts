import { describe, it, expect } from 'vitest';
import { hasAccess, PERMISSIONS } from '../config/permissions';
import type { User, AppView } from '../types';

const createTestUser = (roles: User['roles'], isSuperAdmin = false): User => ({
  id: 'user-test-1',
  email: 'vet@albionclinic.ng',
  name: 'Dr. Chioma Okeke',
  roles,
  clinicId: 'clinic-lagos-1',
  isSuperAdmin,
});

describe('Permission System (hasAccess)', () => {
  it('rejects access when user is null', () => {
    expect(hasAccess(null, 'DASHBOARD')).toBe(false);
    expect(hasAccess(null, 'SUPER_ADMIN')).toBe(false);
  });

  it('grants SuperAdmin access to all views', () => {
    const superAdmin = createTestUser(['Admin'], true);
    const views: AppView[] = [
      'DASHBOARD',
      'SUPER_ADMIN',
      'CLINIC_DETAILS',
      'SETTINGS',
      'AUDIT_LOG',
      'PAYMENT_VERIFICATION',
      'CASH_RECONCILIATION',
      'NARCOTICS_LOCKBOX',
      'SURGERY',
      'LAB_HUB',
    ];

    for (const view of views) {
      expect(hasAccess(superAdmin, view)).toBe(true);
    }
  });

  it('authorizes Veterinarians for clinical and lab modules, but restricts super admin settings', () => {
    const vet = createTestUser(['Veterinarian']);

    expect(hasAccess(vet, 'DASHBOARD')).toBe(true);
    expect(hasAccess(vet, 'TREATMENTS')).toBe(true);
    expect(hasAccess(vet, 'PATIENTS')).toBe(true);
    expect(hasAccess(vet, 'ICU_BOARD')).toBe(true);
    expect(hasAccess(vet, 'SURGERY')).toBe(true);
    expect(hasAccess(vet, 'LAB_HUB')).toBe(true);
    expect(hasAccess(vet, 'NARCOTICS_LOCKBOX')).toBe(true);
    expect(hasAccess(vet, 'CLINICAL_CALCULATORS')).toBe(true);

    // Restricted for plain vet
    expect(hasAccess(vet, 'STAFF')).toBe(false);
    expect(hasAccess(vet, 'AUDIT_LOG')).toBe(false);
    expect(hasAccess(vet, 'SETTINGS')).toBe(false);
    expect(hasAccess(vet, 'PAYMENT_VERIFICATION')).toBe(false);
    expect(hasAccess(vet, 'CASH_RECONCILIATION')).toBe(false);
    expect(hasAccess(vet, 'SUPER_ADMIN')).toBe(false);
  });

  it('authorizes Receptionists for front desk and billing, but restricts clinical and system administration', () => {
    const receptionist = createTestUser(['Receptionist']);

    expect(hasAccess(receptionist, 'DASHBOARD')).toBe(true);
    expect(hasAccess(receptionist, 'APPOINTMENTS')).toBe(true);
    expect(hasAccess(receptionist, 'PATIENT_QUEUE')).toBe(true);
    expect(hasAccess(receptionist, 'CLIENTS')).toBe(true);
    expect(hasAccess(receptionist, 'POS')).toBe(true);
    expect(hasAccess(receptionist, 'INVENTORY')).toBe(true);

    // Restricted for receptionist
    expect(hasAccess(receptionist, 'TREATMENTS')).toBe(false);
    expect(hasAccess(receptionist, 'SURGERY')).toBe(false);
    expect(hasAccess(receptionist, 'LAB_HUB')).toBe(false);
    expect(hasAccess(receptionist, 'NARCOTICS_LOCKBOX')).toBe(false);
    expect(hasAccess(receptionist, 'REPORTS')).toBe(false);
    expect(hasAccess(receptionist, 'STAFF')).toBe(false);
  });

  it('handles multi-role users properly', () => {
    const dualRoleUser = createTestUser(['Receptionist', 'Vet Tech']);

    // From Receptionist
    expect(hasAccess(dualRoleUser, 'POS')).toBe(true);
    // From Vet Tech
    expect(hasAccess(dualRoleUser, 'TRIAGE')).toBe(true);
    expect(hasAccess(dualRoleUser, 'TREATMENTS')).toBe(true);
    expect(hasAccess(dualRoleUser, 'SURGERY')).toBe(true);
  });
});
