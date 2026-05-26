/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. */

import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app')!;
mount(App, { target });
