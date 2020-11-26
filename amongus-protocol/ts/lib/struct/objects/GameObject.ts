import { EventEmitter } from "events";
import { AmongusClient } from "../../Client"
import { PacketID, PayloadID, SpawnID } from "../../constants/Enums";
import { UnlerpValue } from "../../util/Lerp";
import { Component } from "../components/Component";

export interface GameObject {
    on(event: "spawn", listener: (object: GameObject) => void);
}

export class GameObject extends EventEmitter {
    id: number;
    spawnid: SpawnID;
    parentid: number;

    children: GameObject[];
    parent: AmongusClient|GameObject;
    components: Component[];

    constructor (protected client: AmongusClient, parent: AmongusClient|GameObject) {
        super();

        this.parentid = parent.id;

        this.children = [];
        this.components = [];
    }

    awaitChild<T extends GameObject>(filter: SpawnID|((object: T) => boolean) = () => true): Promise<T> {
        const _filter = typeof filter === "number" ? (object => object.spawnid === filter) : filter;

        return new Promise(resolve => {
            const child = this.children.find(_filter) as T;

            if (child) {
                resolve(child);
            }

            this.on("spawn", function onObject(object: T) {
                if (_filter(object)) {
                    this.off("spawn", onObject);

                    resolve(object);
                }
            });
        });
    }

    getComponentsByClassName(classname: string) {
        const components: Component[] = [];

        for (let i = 0; i < this.components.length; i++) {
            const component = this.components[i];

            if (component.classname === classname) {
                components.push(component);
            }
        }

        return components.length ? components : null;
    }


    findChild(filter: (object: GameObject) => boolean): GameObject {
        const child = this.children.find(filter);

        if (child) {
            return child;
        }

        return null;
    }

    isChild(child: GameObject): boolean {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] === child) {
                return true;
            }
        }

        return false;
    }

    removeChild(child: GameObject) {
        for (let i = 0; i < this.children.length; i++) {
            if (this.children[i] === child) {
                this.children.splice(i, 1);
                this.children[i].parent = null;
                break;
            }
        }
    }

    addChild(object: GameObject) {
        if (!this.isChild(object)) {
            this.children.push(object);
            object.parent = this;
        }
    }

    setParent(parent: GameObject) {
        if (this.parent instanceof AmongusClient) throw new Error("Could not set parent, object is global.");

        if (this.parent) {
            this.parent.removeChild(this);
        }

        parent.addChild(this);
    }
}
