import React from 'react';
import { Stack } from 'expo-router';
import type { AccountFilters } from '../database';
import AccountBrowser from '../components/AccountBrowser';

const ALL_ACCOUNTS: AccountFilters = {};

export default function AllAccountsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'All Accounts' }} />
      <AccountBrowser baseFilters={ALL_ACCOUNTS} />
    </>
  );
}
