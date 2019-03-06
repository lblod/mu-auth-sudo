# mu-auth-sudo
NPM package for a sparql client for mu.semte.ch that overrules access rights in queries through a mu-auth-sudo header.

## Usage
```
npm install @lblod/mu-auth-sudo
```

Include the following in your code
```
import { querySudo as query, updateSudo as update } from '@lblod/mu-auth-sudo';
```
