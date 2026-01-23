const arraySorting = (tempData: any[], keyName: string, asc = true) => {
  tempData.sort((a: any, b: any) => {
    if (a[keyName] < b[keyName]) {
      return asc ? -1 : 1;
    }
    if (a[keyName] > b[keyName]) {
      return asc ? 1 : -1;
    }
    return 0;
  });
  return tempData;
};

export default arraySorting;
