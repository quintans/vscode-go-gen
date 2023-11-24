# vscode-go-gen

VS Code extension to generate go code

## Generate extension

```sh
npm install -D typescript
npm install -g @vscode/vsce
vsce package
```

a `.vsix` file will be generate to the project root

## Install in VS Code

to install a `.vsix` file in VS Code:

1. Go to the Extensions view.
1. Click Views and More Actions...
1. Select Install from VSIX...

or

in your terminal, run the following command:

# if you use VS Code
```sh
code --install-extension my-extension-0.0.1.vsix
```
