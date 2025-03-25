import SystemView from "../module/systemView";

export const openSubsystemView = async () => {
    new SystemView().render(true);
  };