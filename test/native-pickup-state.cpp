#include <cassert>

#include "../native/xobse/pickup_state.h"

using echoforge::NextPickupState;
using echoforge::PickupEvent;
using echoforge::PickupPhase;
using echoforge::PickupTransition;

using Reducer = PickupTransition (*)(PickupPhase, PickupEvent);

bool TransitionMatches(
  Reducer reducer,
  PickupPhase current,
  PickupEvent event,
  PickupPhase expected,
  bool removeMovementPackage = false
) {
  const PickupTransition result = reducer(current, event);
  return result.accepted
    && result.next == expected
    && result.removeMovementPackage == removeMovementPackage;
}

bool LifecycleOracle(Reducer reducer) {
  PickupPhase phase = PickupPhase::Idle;
  const auto advance = [&](PickupEvent event, PickupPhase expected, bool remove = false) {
    const PickupTransition result = reducer(phase, event);
    if (!result.accepted || result.next != expected
        || result.removeMovementPackage != remove) return false;
    phase = result.next;
    return true;
  };

  if (!advance(PickupEvent::BeginValidation, PickupPhase::Validating)) return false;
  if (!advance(PickupEvent::RequestMovement, PickupPhase::QueuingMovement)) return false;
  if (!advance(PickupEvent::MovementStarted, PickupPhase::Moving)) return false;
  if (!advance(PickupEvent::ArrivalConfirmed, PickupPhase::Arrived, true)) return false;
  if (!advance(PickupEvent::AnimationQueued, PickupPhase::Animating)) return false;
  if (!advance(PickupEvent::TransferRequested, PickupPhase::Transferring)) return false;
  if (!advance(PickupEvent::TransferDispatched, PickupPhase::Verifying)) return false;
  if (!advance(PickupEvent::WorldItemUnavailable, PickupPhase::Completed)) return false;

  const PickupTransition overlapping = reducer(PickupPhase::Moving, PickupEvent::BeginValidation);
  if (overlapping.accepted) return false;
  const PickupTransition queueFailure = reducer(PickupPhase::QueuingMovement, PickupEvent::Fail);
  if (!queueFailure.accepted || queueFailure.next != PickupPhase::Failed
      || queueFailure.removeMovementPackage) return false;
  const PickupTransition timeout = reducer(PickupPhase::Moving, PickupEvent::Timeout);
  if (!timeout.accepted || timeout.next != PickupPhase::Failed
      || !timeout.removeMovementPackage) return false;
  const PickupTransition load = reducer(PickupPhase::Moving, PickupEvent::SaveLoaded);
  if (!load.accepted
      || load.next != PickupPhase::Interrupted
      || load.removeMovementPackage) return false;
  const PickupTransition interrupted = reducer(PickupPhase::Moving, PickupEvent::Interrupt);
  return interrupted.accepted
    && interrupted.next == PickupPhase::Interrupted
    && interrupted.removeMovementPackage;
}

PickupTransition CompletesBeforeVerification(PickupPhase current, PickupEvent event) {
  if (current == PickupPhase::Transferring && event == PickupEvent::TransferDispatched) {
    return {PickupPhase::Completed, true, false};
  }
  return NextPickupState(current, event);
}

PickupTransition RemovesUnappliedPackage(PickupPhase current, PickupEvent event) {
  if (current == PickupPhase::QueuingMovement && event == PickupEvent::Fail) {
    return {PickupPhase::Failed, true, true};
  }
  return NextPickupState(current, event);
}

PickupTransition IgnoresSaveInterruption(PickupPhase current, PickupEvent event) {
  if (current == PickupPhase::Moving && event == PickupEvent::SaveLoaded) {
    return {PickupPhase::Moving, false, false};
  }
  return NextPickupState(current, event);
}

PickupTransition AllowsOverlappingAction(PickupPhase current, PickupEvent event) {
  if (current == PickupPhase::Moving && event == PickupEvent::BeginValidation) {
    return {PickupPhase::Validating, true, false};
  }
  return NextPickupState(current, event);
}

int main() {
  assert(LifecycleOracle(NextPickupState));
  assert(!LifecycleOracle(CompletesBeforeVerification));
  assert(!LifecycleOracle(RemovesUnappliedPackage));
  assert(!LifecycleOracle(IgnoresSaveInterruption));
  assert(!LifecycleOracle(AllowsOverlappingAction));

  assert(TransitionMatches(
    NextPickupState,
    PickupPhase::Validating,
    PickupEvent::AnimationQueued,
    PickupPhase::Animating
  ));
  assert(TransitionMatches(
    NextPickupState,
    PickupPhase::Moving,
    PickupEvent::WorldItemUnavailable,
    PickupPhase::Completed,
    true
  ));
}
