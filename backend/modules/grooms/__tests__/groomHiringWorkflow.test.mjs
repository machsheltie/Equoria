/**
 * @fileoverview Groom system definitions (GET /grooms/definitions handler).
 *
 * This file once held the hire-workflow cases for the player-built hire
 * (POST /grooms/hire, hireGroom). Equoria-bvddn.7 retired that hire — players
 * never create grooms (owner, 2026-10-21) — and every hire case went with it.
 * This definitions case covers a live endpoint and is unchanged.
 * Real controller call, plain JS response capture object, no mocking.
 */

import { describe, it, expect } from '@jest/globals';
import { getGroomDefinitions } from '../controllers/groomRosterController.mjs';
import { GROOM_SPECIALTIES, SKILL_LEVELS, PERSONALITY_TRAITS } from '../../../utils/groomSystem.mjs';

function makeRes() {
  return {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
  };
}

describe('Groom system definitions', () => {
  it('should retrieve groom definitions with all required data', async () => {
    const req = {};
    const res = makeRes();

    await getGroomDefinitions(req, res);

    expect(res._status).toBe(200);
    expect(res._json).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          specialties: expect.any(Object),
          skillLevels: expect.any(Object),
          personalities: expect.any(Object),
        }),
      }),
    );

    const { specialties } = res._json.data;
    Object.keys(GROOM_SPECIALTIES).forEach(key => {
      expect(specialties).toHaveProperty(key);
    });

    const { skillLevels } = res._json.data;
    Object.keys(SKILL_LEVELS).forEach(key => {
      expect(skillLevels).toHaveProperty(key);
    });

    const { personalities } = res._json.data;
    Object.keys(PERSONALITY_TRAITS).forEach(key => {
      expect(personalities).toHaveProperty(key);
    });
  });
});
