// The UI's typed gateway to the Anki engine. Import area modules from here.
export * as decks from './decks';
export * as scheduler from './scheduler';
export * as cardRendering from './cardRendering';
export * as notes from './notes';
export * as notetypes from './notetypes';
export * as search from './search';
export * as config from './config';
export * as stats from './stats';
export * as tools from './tools';
export { call, invoke, configureRpc, AnkiError, HostUnreachableError } from './rpc';
export { anki } from './proto';
