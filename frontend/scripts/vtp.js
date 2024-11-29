class DataArray {
  /**
   * An array of elements with multiple components
   * @param {Element} node 
   */
  constructor(node) {
    if (node.attributes["format"].value != "ascii") {
      throw new Error("Only ASCII format is supported for DataArray!");
    }

    if ("NumberOfComponents" in node.attributes) {
      this.ncomp = parseInt(node.attributes["NumberOfComponents"].value);
    } else {
      this.ncomp = 1;
    }
    const data = node.innerHTML.split(" ").filter((e) => e != "" && e != "\n");
    const datatype = node.attributes["type"].value;
    if (datatype == "Int64") {
      this.data = new Int32Array(data); // Yes
    } else if (datatype == "Float32") {
      this.data = new Float32Array(data);
    } else {
      throw new Error(`Unknown datatype for DataArray: ${datatype}`);
    }
  }

  /**
   * Number of element of size ncomp
   * @returns {Number}
   */
  get length() {
    return this.data.length / this.ncomp;
  }

  recenter() {
    let avg = Array(this.ncomp).fill(0);

    let idx = 0;
    for (let i = 0; i < this.length; i++) {
      for (let j = 0; j < this.ncomp; j++) {
        avg[j] += this.data[idx++];
      }
    }

    for (let j = 0; j < this.ncomp; j++) {
      avg[j] /= this.length;
    }
    avg = avg.map(Math.round);

    idx = 0;
    for (let i = 0; i < this.length; i++) {
      for (let j = 0; j < this.ncomp; j++) {
        this.data[idx++] -= avg[j];
      }
    }
  }
}

class Piece {
  /**
   * An independent set of points and cells 
   * @param {Element} node 
   */
  constructor(node) {
    this.npoints = parseInt(node.attributes["NumberOfPoints"].value);
    this.ncells = parseInt(node.attributes["NumberOfCells"].value);

    this.points = new DataArray(node.querySelector('Points > DataArray'));
    if ((this.points.data.length / this.points.ncomp) != this.npoints) {
      throw new Error("Number of points mismatch!");
    }

    this.cells = {};
    node.querySelectorAll('Cells > DataArray').forEach((node) => {
      const name = node.attributes["Name"].value;
      if (name == "connectivity") {
        this.cells.connectivity = new DataArray(node);
      } else if (name == "offsets") {
        this.cells.offsets = new DataArray(node);
      } else if (name == "types") {
        this.cells.types = new DataArray(node);
      } else {
        console.warn(`Unknown element in cell: ${name}, ignoring!`);
      }
    });

    this.pointData = new Map();
    node.querySelectorAll('PointData > DataArray').forEach((node) => {
      this.pointData.set(node.attributes["Name"].value, new DataArray(node));
    });

    this.cellData = new Map();
    node.querySelectorAll('CellData > DataArray').forEach((node) => {
      this.cellData.set(node.attributes["Name"].value, new DataArray(node));
    });
  }
}

export class VTP {
  /**
    * @param {Blob} filedata
    */
  constructor(filedata) {
    const vtkroot = new DOMParser().parseFromString(filedata, "text/xml").firstChild;
    if (vtkroot.nodeName != "VTKFile")
      throw new Error("Not a VTK File");

    if (vtkroot.attributes["version"].value != "1.0") {
      throw new Error("Only version 1.0 is supported.");
    }

    if (vtkroot.attributes["type"].value != "UnstructuredGrid") {
      throw new Error("Only Unstructured Grid is supported.");
    }

    if (vtkroot.children.length != 1 || vtkroot.children[0].nodeName != "UnstructuredGrid") {
      throw new Error("Only a single Unstructured Grid should be at the top level.");
    }

    let dataset_root = vtkroot.children[0];

    this.piece = [];
    for (const child of dataset_root.children) {
      let piece = new Piece(child);
      this.piece.push(piece);
    }

    for (const piece of this.piece) {
      piece.points.recenter();
    }
  }
}
