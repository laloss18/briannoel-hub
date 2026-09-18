import { ulid } from 'ulidx';

export function newOpId(): string {
  return ulid();
}

export function newRecordId(): string {
  return ulid();
}
