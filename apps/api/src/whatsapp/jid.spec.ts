import { describe, expect, it } from 'vitest';
import {
  isLidJid,
  resolveContactJid,
  sendTargetFromJid,
} from './jid';

describe('isLidJid', () => {
  it('detecta @lid', () => {
    expect(isLidJid('7194204500216@lid')).toBe(true);
    expect(isLidJid('5511999998888@s.whatsapp.net')).toBe(false);
    expect(isLidJid(null)).toBe(false);
  });
});

describe('sendTargetFromJid', () => {
  it('preserva JID @lid completo', () => {
    expect(sendTargetFromJid('7194204500216@lid', '7194204500216')).toBe(
      '7194204500216@lid',
    );
  });

  it('preserva @s.whatsapp.net e remove sufixo de device', () => {
    expect(sendTargetFromJid('5511999998888@s.whatsapp.net')).toBe(
      '5511999998888@s.whatsapp.net',
    );
    expect(sendTargetFromJid('5511999998888:12@s.whatsapp.net')).toBe(
      '5511999998888@s.whatsapp.net',
    );
  });

  it('reduz telefone formatado a dígitos quando não há JID', () => {
    expect(sendTargetFromJid(null, '+55 11 99999-8888')).toBe('5511999998888');
    expect(sendTargetFromJid('5511999998888')).toBe('5511999998888');
  });

  it('retorna null para entrada vazia', () => {
    expect(sendTargetFromJid('', null)).toBeNull();
    expect(sendTargetFromJid(null, null)).toBeNull();
  });
});

describe('resolveContactJid', () => {
  it('prefere remoteJidAlt quando remoteJid é @lid', () => {
    expect(
      resolveContactJid({
        remoteJid: '7194204500216@lid',
        remoteJidAlt: '5511999998888@s.whatsapp.net',
      }),
    ).toBe('5511999998888@s.whatsapp.net');
  });

  it('mantém remoteJid quando já é número real', () => {
    expect(
      resolveContactJid({
        remoteJid: '5511999998888@s.whatsapp.net',
        remoteJidAlt: '7194204500216@lid',
      }),
    ).toBe('5511999998888@s.whatsapp.net');
  });

  it('cai para remoteJid quando ambos são @lid', () => {
    expect(
      resolveContactJid({
        remoteJid: '7194204500216@lid',
        remoteJidAlt: '123@lid',
      }),
    ).toBe('7194204500216@lid');
  });

  it('usa alt quando remoteJid está vazio', () => {
    expect(
      resolveContactJid({
        remoteJid: '',
        remoteJidAlt: '5511999998888@s.whatsapp.net',
      }),
    ).toBe('5511999998888@s.whatsapp.net');
  });
});
