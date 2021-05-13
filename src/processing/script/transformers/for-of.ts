// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
import { BlockStatement, Declaration, ForOfStatement, Node, Pattern, Statement, VariableDeclaration } from 'estree';
import { Transformer } from './index';
import { Syntax } from 'esotope-hammerhead';
import {
    createAssignmentExprStmt,
    createVariableDeclarator,
    createVariableDeclaration,
    createBlockStatement,
    createIdentifier
} from '../node-builder';
import replaceNode from './replace-node';
import TempVariables from './temp-variables';


// Transform:
// for (let {href, postMessage} of wins) {} -->
// for (let _hh$temp0 of wins) { let {href, postMessage} = _hh$temp0; }

// const objectToString = Object.prototype.toString;
// const objectKeys     = Object.keys;
//
// function shouldProcessNode (node: Node) {
//     return node && (node.type === Syntax.VariableDeclaration || node.type === Syntax.VariableDeclarator);
// }

// function findChildNode (node: Node, predicate: Function, depth = 0): Node {
//     // @ts-ignore
//     const nodeKeys: (keyof Node)[] = objectKeys(node);
//
//     debugger;
//
//     if (predicate(node, depth))
//         return node;
//
//     for (const key of nodeKeys) {
//         const childNode       = node[key];
//         const stringifiedNode = objectToString.call(childNode);
//
//         if (stringifiedNode === '[object Array]') {
//             // @ts-ignore
//             const childNodes = childNode as Node[];
//
//             for (const nthNode of childNodes) {
//                 // NOTE: Some items of ArrayExpression can be null
//                 if (shouldProcessNode(nthNode)) {
//                     const resultNode = findChildNode(nthNode, predicate, depth + 1);
//
//                     if (resultNode)
//                         return resultNode;
//                 }
//             }
//         }
//         // else if (stringifiedNode === '[object Object]' && shouldProcessNode(childNode as unknown as Node)) {
//         //     // @ts-ignore
//         //     const resultNode = findChildNode(childNode!, predicate, depth + 1);
//         //
//         //     if(resultNode)
//         //         return resultNode;
//         // }
//     }
//
//     return null;
// }

function findChildNode (node: BlockStatement, predicate: Function, depth = 0): Node {
    debugger;

    console.log(predicate);
    console.log(depth);

    const declarators = [];
    for (const statement of node.body) {
        if (statement.type === Syntax.VariableDeclaration)
            declarators.push(...statement.declarations);
    }

    for (const declarator of declarators) {
        if (predicate(declarator))
            return declarator;
    }

    return null;
}

function replaceDuplicateLoopDeclarations (forOfLeft: VariableDeclaration, node: ForOfStatement) {
    let nodeToReplace = null;

    const elements = forOfLeft.declarations[0].id['elements'];

    if (!elements)
        return;


    const childDeclaration = findChildNode(node.body as BlockStatement, (n) => {
        if (forOfLeft.declarations[0].id.type === Syntax.ArrayPattern) {
            const leftDeclarations = Object.values(elements);

            if (n.type === Syntax.VariableDeclarator && n.id.type === Syntax.Identifier) {
                for (const ld of leftDeclarations) {
                    // @ts-ignore
                    if (ld.name === n.id.name) {
                        nodeToReplace = ld;

                        return true;
                    }
                }
            }
        }

        return false;
    });

    if (childDeclaration) {
        const destIdentifier = createIdentifier(TempVariables.generateName());

        // @ts-ignore
        replaceNode(nodeToReplace, destIdentifier, forOfLeft.declarations[0].id, 'elements');
    }
}

const transformer: Transformer<ForOfStatement> = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.ForOfStatement,

    condition: node => {
        let left = node.left;

        if (left.type === Syntax.VariableDeclaration)
            left = left.declarations[0].id;

        return left.type === Syntax.ObjectPattern || left.type === Syntax.ArrayPattern;
    },

    run: node => {
        const tempIdentifier = createIdentifier(TempVariables.generateName());
        const forOfLeft      = node.left;

        let statementWithTempAssignment: Statement | Declaration;

        if (forOfLeft.type === Syntax.VariableDeclaration) {
            if (node.body.type === Syntax.BlockStatement) {
                replaceDuplicateLoopDeclarations(forOfLeft, node);
            }

            statementWithTempAssignment = createVariableDeclaration(forOfLeft.kind, [
                createVariableDeclarator(forOfLeft.declarations[0].id, tempIdentifier)
            ]);

            statementWithTempAssignment.reTransform = true;

            replaceNode(forOfLeft.declarations[0].id, tempIdentifier, forOfLeft.declarations[0], 'id');
        }
        else {
            const varDeclaration = createVariableDeclaration('var', [createVariableDeclarator(tempIdentifier)]);

            statementWithTempAssignment = createAssignmentExprStmt(forOfLeft as Pattern, tempIdentifier);

            replaceNode(forOfLeft, varDeclaration, node, 'left');
        }

        if (node.body.type === Syntax.BlockStatement)
            replaceNode(null, statementWithTempAssignment, node.body, 'body');
        else
            replaceNode(node.body, createBlockStatement([statementWithTempAssignment, node.body]), node, 'body');

        return null;
    }
};

export default transformer;
