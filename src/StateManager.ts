import NodeWrapper from "./NodeWrapper";
import { Tool } from "./Tool";
import Konva from "konva";
import TransitionWrapper from "./TransitionWrapper";
import SelectableObject from "./SelectableObject";
import TokenWrapper from "./TokenWrapper";

export default class StateManager {
    public static get startNode(): NodeWrapper | null { return StateManager._startNode; }
    private static _startNode: NodeWrapper | null = null;

    private static _nodeWrappers: Array<NodeWrapper> = [];
    private static _transitionWrappers: Array<TransitionWrapper> = [];
    private static _alphabet: Array<TokenWrapper> = [];

    private static _selectedObjects: Array<SelectableObject> = [];

    private static _tentativeTransitionSource: NodeWrapper | null = null;
    private static _tentativeTransitionTarget: NodeWrapper | null = null;

    private static _currentTool: Tool = Tool.States;

    private static _stage: Konva.Stage | null = null;
    private static _tentConnectionLine: Konva.Arrow | null = null;
    private static _startStateLine: Konva.Arrow | null = null;
    private static _nodeLayer: Konva.Layer | null = null;
    private static _transitionLayer: Konva.Layer | null = null;

    public static setSelectedObjects: React.Dispatch<React.SetStateAction<SelectableObject[]>> | null = null;

    private constructor() {
    }

    public static initialize() {
        this._startNode = null;
        this._nodeWrappers = [];
        this._transitionWrappers = [];

        Konva.hitOnDragEnabled = true;

        this._stage = new Konva.Stage({
            container: 'graphics-container',
            width: window.innerWidth,
            height: window.innerHeight
        });
        this._stage.on('dblclick', (ev) => StateManager.onDoubleClick.call(this, ev));
        this._stage.on('click', (ev) => StateManager.onClick.call(this, ev));

        this._nodeLayer = new Konva.Layer();
        this._transitionLayer = new Konva.Layer();

        this._tentConnectionLine = new Konva.Arrow({
            x: 0,
            y: 0,
            points: [0, 0, 20, 40],
            stroke: 'red',
            fill: 'red',
            strokeWidth: 5,
            lineJoin: 'round',
            dash: [20, 20],
            pointerLength: 10,
            pointerWidth: 10,
            visible: false
        });
        this._transitionLayer.add(this._tentConnectionLine);

        this._startStateLine = new Konva.Arrow({
            x: 0,
            y: 0,
            points: [
                -100, 0, 0 - NodeWrapper.NodeRadius - TransitionWrapper.ExtraTransitionArrowPadding, 0
            ],
            stroke: 'black',
            fill: 'black',
            strokeWidth: 5,
            lineJoin: 'round',
            pointerLength: 10,
            pointerWidth: 10,
            visible: false
        });
        this._transitionLayer.add(this._startStateLine);

        this._stage.add(this._transitionLayer);
        this._stage.add(this._nodeLayer);

        addEventListener('keydown', this.onKeyDown);
    }

    public static get currentTool() {
        return StateManager._currentTool;
    }

    public static set currentTool(tool: Tool) {
        StateManager._currentTool = tool;
    }

    private static onClick(evt: Konva.KonvaEventObject<MouseEvent>) {
        let thingUnderMouse = StateManager._stage.getIntersection(StateManager._stage.getPointerPosition());
        if (!thingUnderMouse) {
            StateManager.deselectAllObjects();
        }
    }

    private static onDoubleClick(evt: Konva.KonvaEventObject<MouseEvent>) {
        if (StateManager.currentTool == Tool.States) {
            StateManager.addStateAtDoubleClickPos(evt);
        }
        else if (StateManager.currentTool == Tool.Transitions) {
            console.log('in transition tool mode, so don\'t do anything');
        }
    }

    private static addStateAtDoubleClickPos(evt: Konva.KonvaEventObject<MouseEvent>) {
        const x = evt.evt.pageX;
        const y = evt.evt.pageY;
        const newStateWrapper = new NodeWrapper(x, y);

        StateManager._nodeWrappers.push(newStateWrapper);

        StateManager._nodeLayer.add(newStateWrapper.nodeGroup);

        if (StateManager._startNode === null) {
            StateManager.startNode = newStateWrapper;
        }
    }

    public static set startNode(node: NodeWrapper | null) {
        if (StateManager._startNode) {
            StateManager._startNode.nodeGroup.off('move.startstate');
        }
        StateManager._startNode = node;

        if (node) {
            node.nodeGroup.on('move.startstate', (ev) => StateManager.updateStartNodePosition());
            StateManager.updateStartNodePosition();
            StateManager._startStateLine.visible(true);
        }
        else {
            StateManager._startStateLine.visible(false);
        }


    }

    private static updateStartNodePosition() {
        StateManager._startStateLine.absolutePosition(StateManager._startNode.nodeGroup.absolutePosition());
    }

    private static onKeyDown(ev: KeyboardEvent) {
        if ((ev.code === "Backspace" || ev.code === "Delete") && ev.ctrlKey) {
            StateManager.deleteAllSelectedObjects();
        }
    }

    public static startTentativeTransition(sourceNode: NodeWrapper) {
        StateManager._tentativeTransitionSource = sourceNode;
        StateManager._tentConnectionLine.visible(true);
        StateManager._tentConnectionLine.setAbsolutePosition(sourceNode.nodeGroup.absolutePosition());
    }

    public static updateTentativeTransitionHead(x: number, y: number) {
        let srcPos = StateManager._tentativeTransitionSource.nodeGroup.absolutePosition();
        if (StateManager.tentativeTransitionTarget === null) {
            let xDelta = x - srcPos.x;
            let yDelta = y - srcPos.y;
            StateManager._tentConnectionLine.points([0, 0, xDelta, yDelta]);
            return;
        }

        // There's a node being targeted, so let's find the point the arrow
        // should point to!
        let dstPos = StateManager.tentativeTransitionTarget.nodeGroup.absolutePosition();

        let xDestRelativeToSrc = dstPos.x - srcPos.x;
        let yDestRelativeToSrc = dstPos.y - srcPos.y;

        let magnitude = Math.sqrt(xDestRelativeToSrc * xDestRelativeToSrc + yDestRelativeToSrc * yDestRelativeToSrc);

        let newMag = NodeWrapper.NodeRadius + TransitionWrapper.ExtraTransitionArrowPadding;
        let xUnitTowardsSrc = xDestRelativeToSrc / magnitude * newMag;
        let yUnitTowardsSrc = yDestRelativeToSrc / magnitude * newMag;

        // Ok, now we have a vector relative to the destination.
        // We need to get this vector relative to the source.

        StateManager._tentConnectionLine.points([0, 0, xDestRelativeToSrc - xUnitTowardsSrc, yDestRelativeToSrc - yUnitTowardsSrc]);
    }

    public static endTentativeTransition() {
        if (StateManager._tentativeTransitionSource !== null && StateManager.tentativeTransitionTarget !== null) {
            const newTransitionWrapper = new TransitionWrapper(StateManager._tentativeTransitionSource, StateManager._tentativeTransitionTarget);
            StateManager._transitionWrappers.push(newTransitionWrapper);
            StateManager._transitionLayer.add(newTransitionWrapper.konvaGroup);
            StateManager._transitionLayer.draw();
        }

        StateManager._tentativeTransitionSource?.disableShadowEffects();
        StateManager._tentativeTransitionTarget?.disableShadowEffects();

        StateManager._tentativeTransitionSource = null;
        StateManager._tentativeTransitionTarget = null;
        StateManager._tentConnectionLine.visible(false);
    }

    public static get tentativeTransitionInProgress() {
        return StateManager._tentativeTransitionSource !== null;
    }

    public static get tentativeTransitionTarget() {
        return StateManager._tentativeTransitionTarget;
    }

    public static set tentativeTransitionTarget(newTarget: NodeWrapper | null) {
        StateManager._tentativeTransitionTarget = newTarget;
    }

    public static set selectedObjects(newArray: Array<SelectableObject>) {
        StateManager._selectedObjects = newArray;
    }

    public static get selectedObjects() {
        return [...StateManager._selectedObjects];
    }

    public static selectObject(obj: SelectableObject) {
        if (StateManager._selectedObjects.includes(obj)) {
            return;
        }
        const currentSelectedObjects = [...StateManager._selectedObjects, obj];
        StateManager.setSelectedObjects(currentSelectedObjects);
        StateManager._selectedObjects = currentSelectedObjects;
        obj.select();
    }

    public static deselectAllObjects() {
        StateManager._selectedObjects.forEach((obj) => obj.deselect());
        StateManager.setSelectedObjects([]);
        StateManager._selectedObjects = [];
    }

    public static deleteAllSelectedObjects() {
        // Find all transitions dependent on selected nodes
        const nodesToRemove = StateManager._nodeWrappers.filter((i) => StateManager._selectedObjects.includes(i));
        const transitionsDependentOnDeletedNodes: Array<TransitionWrapper> = [];
        nodesToRemove.forEach((node) => {
            StateManager._transitionWrappers.forEach((trans) => {
                if (trans.involvesNode(node) && !transitionsDependentOnDeletedNodes.includes(trans)) {
                    transitionsDependentOnDeletedNodes.push(trans);
                }
            });
        });

        // Keep transitions that aren't in the selected objects, AND aren't dependent on selected objects
        StateManager._transitionWrappers = StateManager._transitionWrappers.filter((i) => StateManager._selectedObjects.includes(i) && !transitionsDependentOnDeletedNodes.includes(i));

        // Next, delete all selected nodes
        StateManager._nodeWrappers = StateManager._nodeWrappers.filter((i) => StateManager._selectedObjects.includes(i));

        StateManager._selectedObjects.forEach((obj) => obj.deleteKonvaObjects());
        transitionsDependentOnDeletedNodes.forEach((obj) => obj.deleteKonvaObjects());

        if (nodesToRemove.includes(StateManager._startNode)) {
            StateManager.startNode = null;
        }

        StateManager.setSelectedObjects([]);
        StateManager._selectedObjects = [];
    }

    public static addNewAlphabetToken() {
        StateManager._alphabet.push(new TokenWrapper());

        console.log('Token wrapper added, now the list of token wrappers is', StateManager._alphabet);
    }

    public static deleteAlphabetToken(wrapper: TokenWrapper) {
        StateManager._alphabet = StateManager._alphabet.filter(i => i != wrapper);
    }

    public static set alphabet(newAlphabet: Array<TokenWrapper>) {
        StateManager._alphabet = newAlphabet;
    }
    
    public static get alphabet() {
        return [...StateManager._alphabet];
    }
}