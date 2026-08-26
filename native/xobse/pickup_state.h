#pragma once

namespace echoforge {

enum class PickupPhase {
  Idle,
  Validating,
  QueuingMovement,
  Moving,
  Arrived,
  Animating,
  Transferring,
  Verifying,
  Completed,
  Failed,
  Interrupted
};

enum class PickupEvent {
  BeginValidation,
  RequestMovement,
  MovementStarted,
  ArrivalConfirmed,
  AnimationQueued,
  TransferRequested,
  TransferDispatched,
  WorldItemUnavailable,
  Timeout,
  SaveLoaded,
  Fail,
  Interrupt
};

struct PickupTransition {
  PickupPhase next;
  bool accepted;
  bool removeMovementPackage;
};

constexpr bool IsActivePickupPhase(PickupPhase phase) {
  return phase != PickupPhase::Idle
    && phase != PickupPhase::Completed
    && phase != PickupPhase::Failed
    && phase != PickupPhase::Interrupted;
}

constexpr PickupTransition RejectPickupTransition(PickupPhase current) {
  return {current, false, false};
}

constexpr PickupTransition NextPickupState(PickupPhase current, PickupEvent event) {
  if (current == PickupPhase::Idle && event == PickupEvent::BeginValidation) {
    return {PickupPhase::Validating, true, false};
  }
  if (!IsActivePickupPhase(current)) return RejectPickupTransition(current);

  if (event == PickupEvent::SaveLoaded) {
    return {PickupPhase::Interrupted, true, false};
  }
  if (event == PickupEvent::Interrupt) {
    return {PickupPhase::Interrupted, true, current == PickupPhase::Moving};
  }
  if (event == PickupEvent::Timeout || event == PickupEvent::Fail) {
    return {PickupPhase::Failed, true, current == PickupPhase::Moving};
  }
  if (current == PickupPhase::Validating && event == PickupEvent::RequestMovement) {
    return {PickupPhase::QueuingMovement, true, false};
  }
  if (current == PickupPhase::QueuingMovement && event == PickupEvent::MovementStarted) {
    return {PickupPhase::Moving, true, false};
  }
  if (current == PickupPhase::Moving && event == PickupEvent::ArrivalConfirmed) {
    return {PickupPhase::Arrived, true, true};
  }
  if (current == PickupPhase::Moving && event == PickupEvent::WorldItemUnavailable) {
    return {PickupPhase::Completed, true, true};
  }
  if ((current == PickupPhase::Validating || current == PickupPhase::Arrived)
      && event == PickupEvent::AnimationQueued) {
    return {PickupPhase::Animating, true, false};
  }
  if (current == PickupPhase::Animating && event == PickupEvent::TransferRequested) {
    return {PickupPhase::Transferring, true, false};
  }
  if (current == PickupPhase::Transferring && event == PickupEvent::TransferDispatched) {
    return {PickupPhase::Verifying, true, false};
  }
  if (current == PickupPhase::Verifying && event == PickupEvent::WorldItemUnavailable) {
    return {PickupPhase::Completed, true, false};
  }
  return RejectPickupTransition(current);
}

}  // namespace echoforge
