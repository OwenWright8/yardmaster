// Things to spend your coins on: loco liveries and yard themes.
export interface Livery { id: string; name: string; body: string; trim: string; stripe: string; price: number }
export interface Theme {
  id: string; name: string; price: number;
  ground: string; speck1: string; speck2: string; tree: string[];
  ballast: string; ballastEdge: string; sleeper: string; rail: string; label: string; ui: string;
}

export const LIVERIES: Livery[] = [
  { id: 'works', name: 'Works Yellow', body: '#e0a526', trim: '#3a3a3a', stripe: '#2b2b2b', price: 0 },
  { id: 'red', name: 'Signal Red', body: '#c0392b', trim: '#f2f2f2', stripe: '#f4d03f', price: 150 },
  { id: 'green', name: 'Forest Green', body: '#2e7d32', trim: '#f2c14e', stripe: '#f2c14e', price: 200 },
  { id: 'blue', name: 'Royal Blue', body: '#1f4e79', trim: '#e8e8e8', stripe: '#f4d03f', price: 250 },
  { id: 'mint', name: 'Seaside Mint', body: '#5fc9a8', trim: '#ffffff', stripe: '#ff8a65', price: 350 },
  { id: 'plum', name: 'Midnight Plum', body: '#5b2a86', trim: '#ffd166', stripe: '#ffd166', price: 450 },
  { id: 'gold', name: 'Gold Special', body: '#d4a017', trim: '#3b2a12', stripe: '#fff3c4', price: 800 },
];

export const THEMES: Theme[] = [
  { id: 'meadow', name: 'Meadow', price: 0, ground: '#8cc152', speck1: '#7fb448', speck2: '#9fd060', tree: ['#3f8f3a', '#4ea045', '#2f7a30'],
    ballast: '#bdb5a6', ballastEdge: '#a39b8c', sleeper: '#6b4a32', rail: '#555c63', label: 'rgba(30,50,20,.55)', ui: '#2f6b2a' },
  { id: 'autumn', name: 'Autumn', price: 300, ground: '#b9a04f', speck1: '#a88c3f', speck2: '#caa95a', tree: ['#d9822b', '#b8541f', '#e0a526', '#9c3d2e'],
    ballast: '#c2b7a3', ballastEdge: '#a79c88', sleeper: '#5e3f2a', rail: '#555c63', label: 'rgba(70,40,10,.55)', ui: '#9c4a1a' },
  { id: 'snow', name: 'Snowy', price: 400, ground: '#eef3f7', speck1: '#dfe7ee', speck2: '#ffffff', tree: ['#2f5a45', '#3b6b52', '#25503d'],
    ballast: '#c9ccd1', ballastEdge: '#aeb3ba', sleeper: '#5a4636', rail: '#4a5058', label: 'rgba(40,60,90,.5)', ui: '#3a6ea5' },
  { id: 'desert', name: 'Desert', price: 500, ground: '#e3c27f', speck1: '#d4b06c', speck2: '#efd39a', tree: ['#6b8e3a', '#7a9a45', '#8a6a3a'],
    ballast: '#cdb894', ballastEdge: '#b29c76', sleeper: '#6e4b2e', rail: '#5c5650', label: 'rgba(90,60,20,.55)', ui: '#b5651d' },
  { id: 'night', name: 'Night Yard', price: 650, ground: '#24324a', speck1: '#2c3c58', speck2: '#1d2a3f', tree: ['#1c3a33', '#22463d', '#173029'],
    ballast: '#4b5266', ballastEdge: '#3a4052', sleeper: '#2e2520', rail: '#9aa3b5', label: 'rgba(220,230,255,.5)', ui: '#3b4a7a' },
];
