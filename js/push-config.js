'use strict';

const GASTOPRO_PUSH_VAPID_PUBLIC_KEY = '';

function base64UrlToUint8Array(value) {
  if (typeof value !== 'string' || !value) {
    throw new TypeError('A chave pública VAPID é inválida.');
  }
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function uint8ArrayToBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function getPushActivationGuidance(isStandalone, isIOS) {
  if (isStandalone) return null;
  return isIOS
    ? 'No iPhone, toque em Compartilhar > Adicionar à Tela de Início. Push exige iOS 16.4 ou posterior.'
    : 'Instale o GastoPro na Tela de Início para ativar os avisos push.';
}

function shouldClearPushSnapshotCache(reason) {
  return reason === 'disabled' || reason === 'logout' || reason === 'subscription';
}

function shouldBypassPushSnapshotCache(force) {
  return force === true;
}

window.GastoProPushHelpers = Object.freeze({
  publicKey: GASTOPRO_PUSH_VAPID_PUBLIC_KEY,
  base64UrlToUint8Array,
  uint8ArrayToBase64Url,
  getPushActivationGuidance,
  shouldClearPushSnapshotCache,
  shouldBypassPushSnapshotCache
});
